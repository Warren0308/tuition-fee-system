import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { calculateUnpaidForStudents } from "@/lib/billing-utils";
import { sendNotification, getNotificationStatus } from "@/lib/notifications";
import { formatTermLabelFull } from "@/lib/term-utils";
import { getAcademicYearTerms } from "@/lib/academic-year";

interface NotifyRequest {
  studentIds: string[];
  year: number;
  termIndex: number;
}

function formatMoney(cents: number) {
  return `RM ${(cents / 100).toFixed(2)}`;
}

function generateUnpaidMessage(data: {
  studentName: string;
  gradeName: string;
  year: number;
  termIndex: number;
  termLabel: string;
  unpaidItems: Array<{ name: string; price: number }>;
  totalUnpaid: number;
}): string {
  const lines: string[] = [];
  lines.push("📢 *缴费提醒通知*");
  lines.push("");
  lines.push(`👤 学生: ${data.studentName}`);
  lines.push(`📚 年级: ${data.gradeName}`);
  lines.push(`📅 学期: ${data.termLabel}`);
  lines.push("");
  lines.push("📋 *未支付项目:*");
  data.unpaidItems.forEach((item) => {
    lines.push(`  • ${item.name}: ${formatMoney(item.price)}`);
  });
  lines.push("");
  lines.push(`💰 *未支付总额: ${formatMoney(data.totalUnpaid)}*`);
  lines.push("");
  lines.push("请尽快完成缴费，如有疑问请联系学院。");
  lines.push("感谢您的配合！🙏");
  return lines.join("\n");
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    const body: NotifyRequest = await req.json();
    const { studentIds, year, termIndex } = body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ error: "请选择要通知的学生" }, { status: 400 });
    }
    if (!year || !termIndex) {
      return NextResponse.json({ error: "请指定学期" }, { status: 400 });
    }

    const term = await prisma.term.findFirst({ where: { year, termIndex } });
    if (!term) {
      return NextResponse.json({ error: "学期不存在" }, { status: 404 });
    }

    const academicTerms = await getAcademicYearTerms();
    const termLabels = academicTerms.map((t) => ({
      year: t.year,
      termIndex: t.termIndex,
      period: t.period,
    }));
    const termLabel = formatTermLabelFull(year, termIndex, termLabels);

    // 用统一函数计算未支付
    const unpaidMap = await calculateUnpaidForStudents(studentIds, term.id);

    // 获取学生信息（用于消息生成 + 监护人查询）
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds }, isActive: true },
      include: {
        grade: true,
        guardians: { where: { isPrimary: true }, take: 1 },
      },
    });

    let queuedCount = 0;
    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const status = getNotificationStatus();

    for (const student of students) {
      try {
        const guardian = student.guardians[0];
        if (!guardian?.phone) {
          errors.push(`${student.fullName}: 无监护人联系方式`);
          failedCount++;
          continue;
        }

        const summary = unpaidMap.get(student.id);
        if (!summary || summary.unpaidTotal === 0) {
          continue;
        }

        const unpaidItems = [
          ...summary.unpaidCourses.map((c) => ({ name: c.name, price: c.price })),
          ...summary.unpaidExtraFees.map((f) => ({ name: f.name, price: f.price })),
        ];

        const message = generateUnpaidMessage({
          studentName: student.fullName,
          gradeName: student.grade?.name || '未分配年级',
          year,
          termIndex,
          termLabel,
          unpaidItems,
          totalUnpaid: summary.unpaidTotal,
        });

        const result = await sendNotification({
          channel: 'WHATSAPP',
          target: guardian.phone,
          subject: `缴费提醒 - ${student.fullName}`,
          body: message,
        });

        queuedCount++;
        if (result.success) {
          sentCount++;
        }
      } catch (error) {
        console.error(`发送通知失败 - ${student.fullName}:`, error);
        errors.push(`${student.fullName}: 发送失败`);
        failedCount++;
      }
    }

    return NextResponse.json({
      queued: queuedCount,
      sent: sentCount,
      failed: failedCount,
      total: students.length,
      whatsappConfigured: status.whatsapp,
      errors: errors.slice(0, 10),
      success: queuedCount,
      message:
        sentCount > 0
          ? `已发送 ${sentCount} 条通知`
          : queuedCount > 0
          ? status.whatsapp
            ? `已记录 ${queuedCount} 条通知，但全部发送失败，请检查通知记录`
            : `已记录 ${queuedCount} 条通知，待 WhatsApp API 配置后将自动发送`
          : '未创建任何通知',
    });
  } catch (error) {
    console.error("批量通知失败:", error);
    return NextResponse.json({ error: "批量通知失败，请稍后重试" }, { status: 500 });
  }
}
