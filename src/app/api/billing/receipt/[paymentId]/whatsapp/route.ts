import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { sendNotification, getNotificationStatus } from "@/lib/notifications";
import { formatTermLabelFull } from "@/lib/term-utils";
import { getAcademicYearTerms } from "@/lib/academic-year";
import {
  buildWhatsAppShareUrl,
  generateReceiptMessage,
} from "@/lib/whatsapp-share";

export async function POST(
  req: Request,
  { params }: { params: { paymentId: string } }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    const { paymentId } = params;

    const payment = await prisma.studentTermPayment.findUnique({
      where: { id: paymentId },
      include: {
        items: true,
        student: {
          include: {
            grade: true,
            guardians: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "付款记录不存在" }, { status: 404 });
    }

    const primaryGuardian = payment.student.guardians[0];
    if (!primaryGuardian?.phone) {
      return NextResponse.json({
        error: "未找到监护人电话号码，请先添加监护人信息"
      }, { status: 400 });
    }

    const academicTerms = await getAcademicYearTerms();
    const termLabels = academicTerms.map((t) => ({
      year: t.year,
      termIndex: t.termIndex,
      period: t.period,
    }));
    const termLabel = formatTermLabelFull(payment.year, payment.termIndex, termLabels);

    const message = generateReceiptMessage({
      studentName: payment.student.fullName,
      gradeName: payment.student.grade?.name || '-',
      termLabel,
      items: payment.items,
      total: payment.items.reduce((sum, i) => sum + i.finalCents, 0),
      paidAt: payment.paidAt,
      receiptId: payment.id,
    });

    const status = getNotificationStatus();

    // 通过统一通知服务发送
    const result = await sendNotification({
      channel: 'WHATSAPP',
      target: primaryGuardian.phone,
      subject: `收据 - ${payment.student.fullName}`,
      body: message,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "收据已通过 WhatsApp 发送",
        phone: primaryGuardian.phone,
        guardianName: primaryGuardian.name,
        messageId: result.messageId,
        notificationId: result.notificationId,
      });
    }

    // 未配置 API 时返回 wa.me 分享链接（收费员手动发送）
    if (!status.whatsapp) {
      return NextResponse.json({
        success: false,
        configured: false,
        message: "请使用「分享到 WhatsApp」按钮跳转发送",
        phone: primaryGuardian.phone,
        guardianName: primaryGuardian.name,
        preview: message,
        shareUrl: buildWhatsAppShareUrl(primaryGuardian.phone, message),
        notificationId: result.notificationId,
      });
    }

    return NextResponse.json({
      success: false,
      error: result.error || "发送失败",
      phone: primaryGuardian.phone,
      notificationId: result.notificationId,
    }, { status: 500 });
  } catch (error) {
    console.error("发送 WhatsApp 收据失败:", error);
    return NextResponse.json({
      error: "发送失败",
      details: error instanceof Error ? error.message : "未知错误"
    }, { status: 500 });
  }
}
