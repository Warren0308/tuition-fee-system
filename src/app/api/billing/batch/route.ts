import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { getAcademicYearTerms } from "@/lib/academic-year";
import { activeInTermWhereForBilling } from "@/lib/fee-baseline";

/**
 * 批量结算
 * Body: { year, termIndex, studentIds: string[], skipExisting: boolean }
 * 每个学生按其当期有效的选课和已注册的额外费用生成账单。
 */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const year = Number(body.year);
    const termIndex = Number(body.termIndex);
    const studentIds: string[] = Array.isArray(body.studentIds) ? body.studentIds : [];
    const skipExisting = body.skipExisting !== false;

    if (!year || !termIndex || studentIds.length === 0) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    const term = await prisma.term.findFirst({ where: { year, termIndex } });
    if (!term) {
      return NextResponse.json({ error: "学期不存在" }, { status: 404 });
    }

    const academicTerms = await getAcademicYearTerms();
    const enrollmentWhere = activeInTermWhereForBilling(term.id, academicTerms);

    const students = await prisma.student.findMany({
      where: { id: { in: studentIds }, isActive: true },
      include: {
        enrollments: {
          where: enrollmentWhere,
          include: { course: true },
        },
        extraFees: {
          where: enrollmentWhere,
          include: { extraFeeType: true },
        },
      },
    });

    const allGradeIds = Array.from(new Set(students.map((s) => s.gradeId).filter((id): id is number => id !== null)));
    const courseFees = await prisma.courseFee.findMany({
      where: { gradeId: { in: allGradeIds } },
    });
    const feeMap = new Map<string, number>();
    for (const f of courseFees) {
      feeMap.set(`${f.gradeId}-${f.courseId}`, f.amountCents);
    }

    const results = {
      total: students.length,
      created: 0,
      skipped: 0,
      empty: 0,
      errors: [] as Array<{ studentId: string; name: string; error: string }>,
      payments: [] as Array<{ studentId: string; paymentId: string; amount: number }>,
    };

    for (const s of students) {
      try {
        // 检查是否已有账单
        const existing = await prisma.studentTermPayment.findFirst({
          where: { studentId: s.id, year, termIndex },
        });
        if (existing && skipExisting) {
          results.skipped++;
          continue;
        }

        // 构造账单项
        const items: Array<{
          itemType: string;
          refId: number | null;
          description: string;
          unitCents: number;
          quantity: number;
          fraction: number;
          finalCents: number;
          note: string | null;
        }> = [];

        for (const en of s.enrollments) {
          const fallback = feeMap.get(`${s.gradeId}-${en.courseId}`) ?? 20000;
          const price = en.customPriceCents ?? fallback;
          const note =
            en.customPriceCents != null && en.customPriceCents !== fallback
              ? `选课预设价 RM ${(en.customPriceCents / 100).toFixed(2)}（标准 RM ${(fallback / 100).toFixed(2)}）`
              : null;
          items.push({
            itemType: "COURSE",
            refId: en.courseId,
            description: en.course.name,
            unitCents: fallback,
            quantity: 1,
            fraction: 1,
            finalCents: price,
            note,
          });
        }

        for (const ef of s.extraFees) {
          items.push({
            itemType: "EXTRA_FEE",
            refId: ef.extraFeeTypeId,
            description: ef.extraFeeType.name,
            unitCents: ef.amountCents,
            quantity: 1,
            fraction: 1,
            finalCents: ef.amountCents,
            note: null,
          });
        }

        if (items.length === 0) {
          results.empty++;
          continue;
        }

        const total = items.reduce((sum, i) => sum + i.finalCents, 0);

        // upsert 账单
        const payment = await prisma.studentTermPayment.upsert({
          where: { studentId_year_termIndex: { studentId: s.id, year, termIndex } },
          update: { totalCents: total, paidAt: new Date(), note: "批量结算生成" },
          create: {
            studentId: s.id,
            year,
            termIndex,
            totalCents: total,
            paidAt: new Date(),
            note: "批量结算生成",
          },
        });

        // 重建账单项
        await prisma.studentTermPaymentItem.deleteMany({ where: { paymentId: payment.id } });
        await prisma.studentTermPaymentItem.createMany({
          data: items.map((i) => ({
            paymentId: payment.id,
            itemType: i.itemType,
            refId: i.refId,
            description: i.description,
            unitCents: i.unitCents,
            quantity: i.quantity,
            fraction: i.fraction,
            finalCents: i.finalCents,
            note: i.note,
          })),
        });

        results.created++;
        results.payments.push({
          studentId: s.id,
          paymentId: payment.id,
          amount: total,
        });
      } catch (e: any) {
        results.errors.push({
          studentId: s.id,
          name: s.fullName,
          error: e.message || "未知错误",
        });
      }
    }

    await logAudit("StudentTermPayment", "BATCH_CREATE", {
      after: {
        year,
        termIndex,
        total: results.total,
        created: results.created,
        skipped: results.skipped,
        empty: results.empty,
        errorCount: results.errors.length,
      },
    });

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("批量结算失败:", error);
    return NextResponse.json({ error: error.message || "批量结算失败" }, { status: 500 });
  }
}
