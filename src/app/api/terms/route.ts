import { NextResponse } from "next/server";
import { getAcademicYearTerms } from "@/lib/academic-year";
import { getTermDetails } from "@/lib/term-utils";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/terms — 默认返回 2026 学年 13 期（学期管理数据源） */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const withStats = searchParams.get("stats") === "true";

    const terms = await getAcademicYearTerms();

    if (withStats) {
      const termsWithStats = await Promise.all(
        terms.map(async (term) => {
          const details = await getTermDetails(term.year, term.termIndex);
          return { ...term, statistics: details.statistics };
        })
      );
      return NextResponse.json({ ok: true, data: termsWithStats });
    }

    return NextResponse.json({ ok: true, data: terms });
  } catch (error) {
    console.error("获取学期列表失败:", error);
    return NextResponse.json(
      { ok: false, error: "获取学期列表失败" },
      { status: 500 }
    );
  }
}
