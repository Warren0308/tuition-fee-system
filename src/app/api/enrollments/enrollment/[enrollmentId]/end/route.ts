import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRedirect } from "@/lib/api-auth";

export async function POST(req: Request, { params }: { params: { enrollmentId: string } }) {
  const auth = await requireAuthOrRedirect(req);
  if (!auth.ok) return auth.response;

  const id = Number(params.enrollmentId);
  const form = await req.formData();
  const endTermId = Number(form.get("endTermId"));
  if (!id || !endTermId) return NextResponse.json({ ok: false, error: "参数不完整" }, { status: 400 });
  try {
    await prisma.studentEnrollment.update({ where: { id }, data: { endTermId } });
    const record = await prisma.studentEnrollment.findUnique({ where: { id } });
    return NextResponse.redirect(new URL(`/students/${record?.studentId}/enroll`, req.url));
  } catch (e) {
    console.error("结束选课失败:", e);
    return NextResponse.json({ ok: false, error: "操作失败" }, { status: 500 });
  }
}


