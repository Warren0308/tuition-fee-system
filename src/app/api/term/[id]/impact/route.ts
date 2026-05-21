import { NextResponse } from "next/server";
import { checkTermDateChangeImpact } from "@/lib/term-utils";
import { parseLocalDate } from "@/lib/date-utils";
import { requireAdmin } from "@/lib/api-auth";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const id = Number(params.id);
    if (!id) {
      return NextResponse.json({ ok: false, error: "无效ID" }, { status: 400 });
    }

    const url = new URL(req.url);
    const startDateStr = url.searchParams.get("startDate");
    if (!startDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
      return NextResponse.json({ ok: false, error: "日期格式错误" }, { status: 400 });
    }

    const startDate = parseLocalDate(startDateStr);
    const impact = await checkTermDateChangeImpact(id, startDate);

    return NextResponse.json({ ok: true, impact });
  } catch (error) {
    console.error("学期影响检查失败:", error);
    return NextResponse.json(
      { ok: false, error: "影响检查失败" },
      { status: 500 }
    );
  }
}
