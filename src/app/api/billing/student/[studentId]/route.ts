import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { studentId: string } }) {
  const { studentId } = params;
  const form = await req.formData();
  const year = Number(form.get("year"));
  const termIndex = Number(form.get("termIndex"));
  if (!year || !termIndex) return NextResponse.json({ ok: false, error: "参数不完整" }, { status: 400 });

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      grade: true,
      enrollments: { where: { endTermId: null }, include: { course: true } },
    },
  });
  if (!student) return NextResponse.json({ ok: false, error: "学生不存在" }, { status: 404 });

  const fees = await prisma.courseFee.findMany({ where: { gradeId: student.gradeId } });
  const courseIdToFee = new Map(fees.map(f => [f.courseId, f]));

  const items = [] as Array<{ description: string; unitCents: number; quantity: number; fraction: number; finalCents: number; itemType: string; refId?: number | null; }>;
  for (const en of student.enrollments) {
    const fee = courseIdToFee.get(en.courseId);
    if (!fee) continue;
    items.push({ description: en.course.name, unitCents: fee.amountCents, quantity: 1, fraction: 1, finalCents: fee.amountCents, itemType: "COURSE", refId: en.courseId });
  }

  const total = items.reduce((sum, i) => sum + i.finalCents, 0);
  const payment = await prisma.studentTermPayment.upsert({
    where: { studentId_year_termIndex: { studentId, year, termIndex } },
    update: {},
    create: { studentId, year, termIndex, totalCents: total },
  });

  const existing = await prisma.studentTermPaymentItem.findMany({ where: { paymentId: payment.id } });
  if (existing.length === 0 && items.length > 0) {
    await prisma.studentTermPaymentItem.createMany({ data: items.map(i => ({ paymentId: payment.id, itemType: i.itemType, refId: i.refId ?? null, description: i.description, unitCents: i.unitCents, quantity: i.quantity, fraction: i.fraction, finalCents: i.finalCents })) });
  }

  return NextResponse.redirect(new URL(`/billing/receipt/${payment.id}`, req.url));
}


