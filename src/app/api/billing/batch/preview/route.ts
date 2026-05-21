import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { getAcademicYearTerms } from "@/lib/academic-year";
import { activeInTermWhereForBilling } from "@/lib/fee-baseline";
import { studentBillableInTermWhere } from "@/lib/student-billing-eligibility";

/**
 * 批量结算 - 预览
 * 给定 year/termIndex 和 筛选条件（gradeId、className）
 * 返回符合条件的所有学生及其预计应缴金额、已有账单状态
 */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const year = Number(body.year);
    const termIndex = Number(body.termIndex);
    const gradeId = body.gradeId ? Number(body.gradeId) : null;
    const className = body.className ? String(body.className).trim() : null;
    const schoolId = body.schoolId ? Number(body.schoolId) : null;

    if (!year || !termIndex) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    const term = await prisma.term.findFirst({ where: { year, termIndex } });
    if (!term) {
      return NextResponse.json({ error: "学期不存在" }, { status: 404 });
    }

    const academicTerms = await getAcademicYearTerms();
    const enrollmentWhere = activeInTermWhereForBilling(term.id, academicTerms);

    const studentWhere: Record<string, unknown> = {
      ...studentBillableInTermWhere(term.id, academicTerms),
    };
    if (gradeId) studentWhere.gradeId = gradeId;
    if (className) studentWhere.className = className;
    if (schoolId) studentWhere.schoolId = schoolId;

    const students = await prisma.student.findMany({
      where: studentWhere,
      include: {
        grade: true,
        school: true,
        enrollments: {
          where: enrollmentWhere,
          include: { course: true },
        },
        extraFees: {
          where: enrollmentWhere,
          include: { extraFeeType: true },
        },
      },
      orderBy: [{ grade: { orderIndex: 'asc' } }, { fullName: 'asc' }],
    });

    // 预加载所有相关 grade 的课程费率
    const allGradeIds = Array.from(new Set(students.map((s) => s.gradeId).filter((id): id is number => id !== null)));
    const courseFees = await prisma.courseFee.findMany({
      where: { gradeId: { in: allGradeIds } },
    });
    const feeMap = new Map<string, number>();
    for (const f of courseFees) {
      feeMap.set(`${f.gradeId}-${f.courseId}`, f.amountCents);
    }

    // 检查每个学生是否已有该学期账单
    const existingPayments = await prisma.studentTermPayment.findMany({
      where: {
        studentId: { in: students.map((s) => s.id) },
        year,
        termIndex,
      },
      include: { items: true },
    });
    const paymentMap = new Map<string, (typeof existingPayments)[number]>();
    for (const p of existingPayments) {
      paymentMap.set(p.studentId, p);
    }

    // 计算每个学生的预计金额
    const previews = students.map((s) => {
      let courseTotal = 0;
      const courseItems = s.enrollments.map((en) => {
        const fallback = feeMap.get(`${s.gradeId}-${en.courseId}`) ?? 20000;
        const price = en.customPriceCents ?? fallback;
        courseTotal += price;
        return {
          name: en.course.name,
          price,
          courseId: en.courseId,
          enrollmentId: en.id,
        };
      });

      let extraTotal = 0;
      const extraItems = s.extraFees.map((ef) => {
        extraTotal += ef.amountCents;
        return {
          name: ef.extraFeeType.name,
          price: ef.amountCents,
          extraFeeTypeId: ef.extraFeeTypeId,
        };
      });

      const total = courseTotal + extraTotal;
      const existing = paymentMap.get(s.id);

      return {
        studentId: s.id,
        name: s.fullName,
        gradeName: s.grade?.name || null,
        schoolName: s.school?.name || null,
        className: s.className,
        courseItems,
        extraItems,
        expectedTotal: total,
        hasBill: !!existing,
        existingTotal: existing?.totalCents ?? 0,
        existingItemCount: existing?.items.length ?? 0,
      };
    });

    return NextResponse.json({
      term: { id: term.id, year, termIndex },
      total: previews.length,
      withBill: previews.filter((p) => p.hasBill).length,
      withoutBill: previews.filter((p) => !p.hasBill).length,
      students: previews,
    });
  } catch (error: any) {
    console.error("批量结算预览失败:", error);
    return NextResponse.json({ error: error.message || "预览失败" }, { status: 500 });
  }
}
