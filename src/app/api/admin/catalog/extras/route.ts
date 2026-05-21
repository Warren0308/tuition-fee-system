import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const form = await req.formData();
  const typeId = Number(form.get("typeId"));
  const gradeId = Number(form.get("gradeId"));
  const amountCents = Number(form.get("amountCents"));
  if (!typeId || !gradeId || !amountCents) return NextResponse.json({ ok: false, error: "参数不完整" }, { status: 400 });
  await prisma.extraFeeRate.create({ data: { extraFeeTypeId: typeId, gradeId, amountCents } });
  return NextResponse.redirect(new URL("/admin/catalog/extras", req.url));
}


