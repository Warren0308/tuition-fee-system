import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const form = await req.formData();
  const courseId = Number(form.get("courseId"));
  const gradeId = Number(form.get("gradeId"));
  const amountCents = Number(form.get("amountCents"));
  if (!courseId || !gradeId || !amountCents) return NextResponse.json({ ok: false, error: "参数不完整" }, { status: 400 });
  await prisma.courseFee.create({ data: { courseId, gradeId, amountCents } });
  return NextResponse.redirect(new URL("/admin/catalog/fees", req.url));
}


