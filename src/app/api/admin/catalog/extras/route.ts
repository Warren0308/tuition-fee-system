import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const form = await req.formData();
  const typeId = Number(form.get("typeId"));
  const gradeId = Number(form.get("gradeId"));
  const amountCents = Number(form.get("amountCents"));
  if (!typeId || !gradeId || !amountCents) return NextResponse.json({ ok: false, error: "参数不完整" }, { status: 400 });
  // 避免重复创建同 type+grade 的费率：先查后写
  const existing = await prisma.extraFeeRate.findFirst({
    where: { extraFeeTypeId: typeId, gradeId },
    orderBy: { effectiveFrom: 'desc' },
  });
  if (existing) {
    await prisma.extraFeeRate.update({
      where: { id: existing.id },
      data: { amountCents, effectiveFrom: new Date() },
    });
  } else {
    await prisma.extraFeeRate.create({
      data: { extraFeeTypeId: typeId, gradeId, amountCents },
    });
  }
  return NextResponse.redirect(new URL("/admin/catalog/extras", req.url));
}


