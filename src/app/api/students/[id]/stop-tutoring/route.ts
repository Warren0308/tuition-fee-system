import { NextResponse } from "next/server";
import { requireAuthOrRedirect } from "@/lib/api-auth";
import { stopStudentTutoring, resumeStudentTutoring } from "@/lib/student-billing-eligibility";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuthOrRedirect(req);
  if (!auth.ok) return auth.response;

  const studentId = params.id;
  const form = await req.formData();
  const action = String(form.get("action") || "stop").toLowerCase();

  try {
    if (action === "resume") {
      await resumeStudentTutoring(studentId);
      return NextResponse.redirect(new URL(`/students/${studentId}`, req.url));
    }

    const lastTermId = Number(form.get("lastTermId"));
    if (!lastTermId) {
      return NextResponse.json({ ok: false, error: "请选择最后一期就读" }, { status: 400 });
    }

    await stopStudentTutoring(studentId, lastTermId);
    const redirectTo = String(form.get("redirect") || `/students/${studentId}`);
    return NextResponse.redirect(new URL(redirectTo, req.url));
  } catch (e) {
    const message = e instanceof Error ? e.message : "操作失败";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
