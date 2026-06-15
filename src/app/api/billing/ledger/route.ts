import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAcademicYearTerms } from "@/lib/academic-year";
import { requireAuth } from "@/lib/api-auth";
import { resolveFeeLookupTermId } from "@/lib/fee-baseline";

export async function GET(req: Request) {
  await requireAuth();

  const { searchParams } = new URL(req.url);
  const courseFilter = searchParams.get("course");
  const extraFeeFilter = searchParams.get("extraFee");

  try {
    const terms = await getAcademicYearTerms();
    if (terms.length === 0) {
      return NextResponse.json({ terms: [], students: [], filters: { courses: [], extraFeeTypes: [] } });
    }

    const relevantTerms = terms.filter((t) => t.period <= 13);

    const [allStudents, allCourseFees] = await Promise.all([
      prisma.student.findMany({
        where: { isActive: true },
        include: {
          grade: true,
          enrollments: {
            include: { course: true, startTerm: true, endTerm: true },
          },
          extraFees: {
            include: { extraFeeType: true, startTerm: true, endTerm: true },
          },
        },
        orderBy: [{ grade: { orderIndex: "asc" } }, { fullName: "asc" }],
      }),
      prisma.courseFee.findMany(),
    ]);

    const courseFeeMap = new Map<string, number>();
    for (const cf of allCourseFees) {
      courseFeeMap.set(`${cf.courseId}_${cf.gradeId}`, cf.amountCents);
    }

    const studentIds = allStudents.map((s) => s.id);

    const [allPayments, allForceCloses] = await Promise.all([
      prisma.studentTermPayment.findMany({
        where: {
          studentId: { in: studentIds },
          term: { id: { in: relevantTerms.map((t) => t.id) } },
        },
        include: { items: true, term: true },
      }),
      prisma.studentTermForceClose.findMany({
        where: { studentId: { in: studentIds } },
      }),
    ]);

    const paymentMap = new Map<string, (typeof allPayments)[number]>();
    for (const p of allPayments) {
      paymentMap.set(`${p.studentId}_${p.term.year}_${p.term.termIndex}`, p);
    }

    const forceCloseSet = new Set(
      allForceCloses.map((fc) => `${fc.studentId}_${fc.year}_${fc.termIndex}`)
    );

    type TermCell = {
      shouldPay: number;
      paid: number;
      paidAt: string | null;
      forceClosed: boolean;
      items: { name: string; amount: number; paid: boolean; paidAmount: number }[];
    };

    type StudentRow = {
      id: string;
      name: string;
      grade: string;
      gradeOrder: number;
      terms: Record<number, TermCell>;
    };

    const studentRows: StudentRow[] = [];

    for (const student of allStudents) {
      let hasRelevantItem = false;
      const gradeId = student.gradeId;

      const row: StudentRow = {
        id: student.id,
        name: student.fullName,
        grade: student.grade?.name || "未分配",
        gradeOrder: student.grade?.orderIndex || 999,
        terms: {},
      };

      for (const term of relevantTerms) {
        const feeTermId = resolveFeeLookupTermId(term.id, terms);
        const isForceClosed = forceCloseSet.has(
          `${student.id}_${term.year}_${term.termIndex}`
        );

        const activeEnrollments = student.enrollments.filter((e) => {
          const sid = e.startTerm.id;
          const eid = e.endTerm?.id;
          return sid <= feeTermId && (eid == null || eid >= feeTermId);
        });

        const activeExtraFees = student.extraFees.filter((f) => {
          const sid = f.startTerm.id;
          const eid = f.endTerm?.id;
          return sid <= feeTermId && (eid == null || eid >= feeTermId);
        });

        const filteredEnrollments = courseFilter
          ? activeEnrollments.filter((e) => String(e.courseId) === courseFilter)
          : activeEnrollments;
        const filteredExtraFees = extraFeeFilter
          ? activeExtraFees.filter((f) => String(f.extraFeeTypeId) === extraFeeFilter)
          : courseFilter
            ? []
            : activeExtraFees;

        if (filteredEnrollments.length === 0 && filteredExtraFees.length === 0) continue;
        hasRelevantItem = true;

        const payment = paymentMap.get(
          `${student.id}_${term.year}_${term.termIndex}`
        );

        const items: TermCell["items"] = [];
        let shouldPay = 0;
        let paidTotal = 0;

        for (const en of filteredEnrollments) {
          const standardPrice = courseFeeMap.get(`${en.courseId}_${gradeId}`) ?? 0;
          const price = en.customPriceCents ?? standardPrice;
          shouldPay += price;
          const paidItem = payment?.items.find(
            (it) => it.itemType === "COURSE" && it.refId === en.courseId
          );
          const paidAmt = paidItem?.finalCents ?? 0;
          items.push({
            name: en.course.name,
            amount: price,
            paid: !!paidItem,
            paidAmount: paidAmt,
          });
          paidTotal += paidAmt;
        }

        for (const ef of filteredExtraFees) {
          shouldPay += ef.amountCents;
          const paidItem = payment?.items.find(
            (it) =>
              (it.itemType === "EXTRA_FEE" || it.itemType === "TEMP_EXTRA_FEE") &&
              it.refId === ef.extraFeeTypeId
          );
          const paidAmt = paidItem?.finalCents ?? 0;
          items.push({
            name: ef.extraFeeType.name,
            amount: ef.amountCents,
            paid: !!paidItem,
            paidAmount: paidAmt,
          });
          paidTotal += paidAmt;
        }

        row.terms[term.period] = {
          shouldPay,
          paid: paidTotal,
          paidAt: payment?.paidAt?.toISOString() || null,
          forceClosed: isForceClosed,
          items,
        };
      }

      if (hasRelevantItem) {
        studentRows.push(row);
      }
    }

    const [courses, extraFeeTypes] = await Promise.all([
      prisma.course.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.extraFeeType.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    return NextResponse.json({
      terms: relevantTerms.map((t) => ({
        period: t.period,
        year: t.year,
        termIndex: t.termIndex,
      })),
      students: studentRows,
      filters: { courses, extraFeeTypes },
    });
  } catch (error) {
    console.error("Ledger API error:", error);
    return NextResponse.json({ error: "获取台账数据失败" }, { status: 500 });
  }
}
