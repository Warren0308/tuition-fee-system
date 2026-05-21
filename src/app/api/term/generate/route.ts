import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { syncAcademicYearTermsFromConfig } from "@/lib/academic-year";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const count = await syncAcademicYearTermsFromConfig();
  if (count === 0) {
    return NextResponse.json(
      { ok: false, error: "请先设置第1期起始日期" },
      { status: 400 }
    );
  }

  return NextResponse.redirect(new URL("/admin/terms", req.url));
}
