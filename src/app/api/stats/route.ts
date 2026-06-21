import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessStats, requireAuth } from "@/lib/api-auth";
import { getAcademicYearTerms } from "@/lib/academic-year";
import { calculateUnpaidForStudents } from "@/lib/billing-utils";
import { studentBillableInTermWhere } from "@/lib/student-billing-eligibility";
import { billingCyclePaymentWhere } from "@/lib/term-utils";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!canAccessStats(auth.session.roles)) {
    return NextResponse.json({ error: "无权访问统计数据" }, { status: 403 });
  }

  try {
    const [terms, allPayments] = await Promise.all([
      getAcademicYearTerms(),
      prisma.studentTermPayment.findMany({
        where: billingCyclePaymentWhere(),
        include: {
          items: true,
          student: { include: { grade: true } },
          term: true,
        },
      }),
    ]);

    const periodByCoords = new Map(
      terms.map((t) => [`${t.year}_${t.termIndex}`, t.period])
    );

    // ── 1. 各学期收入 & 笔数 ──────────────────────────────────
    const termRevenue: Record<number, { revenue: number; count: number; paidCount: number }> = {};
    for (const t of terms) termRevenue[t.period] = { revenue: 0, count: 0, paidCount: 0 };
    for (const p of allPayments) {
      const period = periodByCoords.get(`${p.year}_${p.termIndex}`);
      if (!period) continue;
      termRevenue[period].revenue += p.totalCents;
      termRevenue[period].count += 1;
      if (p.paidAt) termRevenue[period].paidCount += 1;
    }

    // ── 2. 各学期各课程收入 ──────────────────────────────────
    const courseByTerm: Record<number, Record<string, number>> = {};
    for (const t of terms) courseByTerm[t.period] = {};
    for (const p of allPayments) {
      const period = periodByCoords.get(`${p.year}_${p.termIndex}`);
      if (!period) continue;
      for (const item of p.items) {
        if (item.itemType !== "COURSE") continue;
        const name = item.description;
        courseByTerm[period][name] = (courseByTerm[period][name] || 0) + item.finalCents;
      }
    }

    // ── 3. 全局课程统计 ──────────────────────────────────────
    const courseMap: Record<string, { revenue: number; count: number }> = {};
    for (const p of allPayments) {
      for (const item of p.items) {
        if (item.itemType !== "COURSE") continue;
        if (!courseMap[item.description])
          courseMap[item.description] = { revenue: 0, count: 0 };
        courseMap[item.description].revenue += item.finalCents;
        courseMap[item.description].count += 1;
      }
    }
    const topCourses = Object.entries(courseMap)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, v]) => ({ name, ...v }));

    // ── 4. 额外费用统计 ──────────────────────────────────────
    const extraMap: Record<string, { revenue: number; count: number }> = {};
    for (const p of allPayments) {
      for (const item of p.items) {
        if (!["EXTRA_FEE", "TEMP_EXTRA_FEE"].includes(item.itemType)) continue;
        if (!extraMap[item.description])
          extraMap[item.description] = { revenue: 0, count: 0 };
        extraMap[item.description].revenue += item.finalCents;
        extraMap[item.description].count += 1;
      }
    }
    const extraFees = Object.entries(extraMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([name, v]) => ({ name, ...v }));

    // ── 5. 学生年级分布 ──────────────────────────────────────
    const [gradeStudents, allGrades] = await Promise.all([
      prisma.student.groupBy({
        by: ["gradeId"],
        where: { isActive: true },
        _count: true,
      }),
      prisma.grade.findMany({ orderBy: { orderIndex: "asc" } }),
    ]);
    const gradeMap = new Map(allGrades.map((g) => [g.id, g]));
    const gradeDistrib = gradeStudents
      .map((g) => ({
        name: gradeMap.get(g.gradeId)?.name || "未分配",
        order: gradeMap.get(g.gradeId)?.orderIndex || 999,
        count: g._count,
      }))
      .sort((a, b) => a.order - b.order);

    // ── 6. 当期缴费率(各学期) ────────────────────────────────
    const termPaymentRate: Record<
      number,
      { shouldPayStudents: number; paidStudents: number; paymentRate: number }
    > = {};

    // 只计算有数据的学期（不超过当前已录入账单的学期）
    const periodsWithData = Object.entries(termRevenue)
      .filter(([, v]) => v.count > 0)
      .map(([p]) => Number(p));

    for (const period of periodsWithData) {
      const term = terms.find((t) => t.period === period);
      if (!term) continue;

      const students = await prisma.student.findMany({
        where: studentBillableInTermWhere(term.id, terms),
        select: { id: true },
      });
      if (students.length === 0) {
        termPaymentRate[period] = {
          shouldPayStudents: 0,
          paidStudents: 0,
          paymentRate: 0,
        };
        continue;
      }

      const unpaidMap = await calculateUnpaidForStudents(
        students.map((s) => s.id),
        term.id
      );

      let paidCount = 0;
      for (const summary of unpaidMap.values()) {
        if (summary.unpaidTotal === 0) paidCount++;
      }

      termPaymentRate[period] = {
        shouldPayStudents: students.length,
        paidStudents: paidCount,
        paymentRate:
          students.length > 0
            ? Math.round((paidCount / students.length) * 100)
            : 0,
      };
    }

    // ── 7. 年级 × 课程 交叉收入 ──────────────────────────────
    const gradeCourseMatrix: Record<string, Record<string, number>> = {};
    for (const p of allPayments) {
      const gradeName = p.student.grade?.name || "未分配";
      for (const item of p.items) {
        if (item.itemType !== "COURSE") continue;
        if (!gradeCourseMatrix[gradeName]) gradeCourseMatrix[gradeName] = {};
        gradeCourseMatrix[gradeName][item.description] =
          (gradeCourseMatrix[gradeName][item.description] || 0) + item.finalCents;
      }
    }

    // ── 8. 学期 × 年级 交叉收入 ──────────────────────────────
    const termGradeMatrix: Record<number, Record<string, number>> = {};
    for (const t of terms) termGradeMatrix[t.period] = {};
    for (const p of allPayments) {
      const period = periodByCoords.get(`${p.year}_${p.termIndex}`);
      if (!period) continue;
      const gradeName = p.student.grade?.name || "未分配";
      termGradeMatrix[period][gradeName] =
        (termGradeMatrix[period][gradeName] || 0) + p.totalCents;
    }

    // ── 9. 总结摘要 ──────────────────────────────────────────
    const totalRevenue = allPayments.reduce((s, p) => s + p.totalCents, 0);
    const totalPayments = allPayments.length;
    const activeStudents = await prisma.student.count({ where: { isActive: true } });

    // 所有课程名（有缴费记录）
    const allCourseNames = [...new Set(allPayments.flatMap((p) =>
      p.items.filter((i) => i.itemType === "COURSE").map((i) => i.description)
    ))].sort();

    // 所有年级名（有缴费记录的学生）
    const allGradeNames = allGrades.map((g) => g.name);

    return NextResponse.json({
      terms: terms.map((t) => ({ period: t.period, year: t.year, termIndex: t.termIndex })),
      termRevenue,
      courseByTerm,
      topCourses,
      extraFees,
      gradeDistrib,
      termPaymentRate,
      gradeCourseMatrix,
      termGradeMatrix,
      allCourseNames,
      allGradeNames,
      summary: {
        totalRevenue,
        totalPayments,
        activeStudents,
        termCount: terms.length,
      },
    });
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json({ error: "获取统计数据失败" }, { status: 500 });
  }
}
