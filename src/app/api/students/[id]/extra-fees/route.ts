import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRedirect } from "@/lib/api-auth";
import { getAcademicYearTerms } from "@/lib/academic-year";
import { extraFeeRangeOverlaps } from "@/lib/extra-fee-periods";

/** 新增一段额外费用（同一类型可有多段，中间学期可不收） */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuthOrRedirect(req);
  if (!auth.ok) return auth.response;

  const studentId = params.id;
  const form = await req.formData();
  const extraFeeTypeId = Number(form.get("extraFeeTypeId"));
  const startTermId = Number(form.get("startTermId"));
  const endTermIdRaw = form.get("endTermId");
  const endTermId =
    endTermIdRaw && String(endTermIdRaw).trim() !== ""
      ? Number(endTermIdRaw)
      : null;
  const priceStr = String(form.get("price") || "").trim();
  const price = parseFloat(priceStr);

  if (!extraFeeTypeId || !startTermId || !priceStr || isNaN(price) || price < 0) {
    return NextResponse.json({ ok: false, error: "请填写费用类型、开始学期和金额" }, { status: 400 });
  }

  if (endTermId != null && endTermId < startTermId) {
    return NextResponse.json({ ok: false, error: "结束学期不能早于开始学期" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, gradeId: true },
  });
  if (!student) {
    return NextResponse.json({ ok: false, error: "学生不存在" }, { status: 404 });
  }

  const [terms, existingSameType] = await Promise.all([
    getAcademicYearTerms(),
    prisma.studentExtraFee.findMany({
      where: { studentId, extraFeeTypeId },
    }),
  ]);

  if (extraFeeRangeOverlaps(existingSameType, startTermId, endTermId, terms)) {
    return NextResponse.json(
      { ok: false, error: "所选学期与已有同类型收费段重叠，请调整或先结束旧记录" },
      { status: 400 }
    );
  }

  const amountCents = Math.round(price * 100);

  await prisma.studentExtraFee.create({
    data: {
      studentId,
      extraFeeTypeId,
      startTermId,
      endTermId,
      amountCents,
    },
  });

  await prisma.studentChangeLog.create({
    data: {
      studentId,
      action: "EXTRA_FEE_ADD",
      after: { extraFeeTypeId, startTermId, endTermId, amountCents },
    },
  });

  return NextResponse.redirect(new URL(`/students/${studentId}/enroll`, req.url));
}
