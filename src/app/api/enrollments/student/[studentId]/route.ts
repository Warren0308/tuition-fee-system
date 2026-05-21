import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { studentId: string } }) {
  const studentId = params.studentId;
  const form = await req.formData();
  const courseId = Number(form.get("courseId"));
  const startTermId = Number(form.get("startTermId"));
  if (!courseId || !startTermId) return NextResponse.json({ ok: false, error: "参数不完整" }, { status: 400 });
  await prisma.studentEnrollment.create({ data: { studentId, courseId, startTermId } });
  return NextResponse.redirect(new URL(`/students/${studentId}/enroll`, req.url));
}


