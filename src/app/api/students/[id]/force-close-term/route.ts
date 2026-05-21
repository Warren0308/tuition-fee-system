import { NextResponse } from "next/server";
import { requireAuthOrRedirect } from "@/lib/api-auth";
import {
  forceCloseTerm,
  undoForceCloseTerm,
} from "@/lib/term-force-close";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuthOrRedirect(req);
  if (!auth.ok) return auth.response;

  const studentId = params.id;
  const form = await req.formData();
  const action = String(form.get("action") || "close");
  const year = Number(form.get("year"));
  const termIndex = Number(form.get("termIndex"));

  if (!year || !termIndex) {
    return NextResponse.json({ ok: false, error: "参数不完整" }, { status: 400 });
  }

  try {
    if (action === "undo") {
      await undoForceCloseTerm(studentId, year, termIndex);
    } else {
      await forceCloseTerm(studentId, year, termIndex);
    }
    return NextResponse.redirect(new URL(`/students/${studentId}`, req.url));
  } catch (e) {
    const message = e instanceof Error ? e.message : "操作失败";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
