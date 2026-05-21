import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseLocalDate } from "@/lib/date-utils";
import { requireAdmin, requireAuth } from "@/lib/api-auth";
import { ACADEMIC_YEAR } from "@/lib/term-utils";
import { syncAcademicYearTermsFromConfig } from "@/lib/academic-year";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const form = await req.formData();
  const term1Date = form.get("term1Date") as string;
  if (!term1Date) {
    return NextResponse.json({ ok: false, error: "参数不完整" }, { status: 400 });
  }

  const parsedDate = parseLocalDate(term1Date);
  await prisma.termConfig.upsert({
    where: { year: ACADEMIC_YEAR },
    update: { term1Date: parsedDate },
    create: { year: ACADEMIC_YEAR, term1Date: parsedDate },
  });

  await syncAcademicYearTermsFromConfig();
  return NextResponse.redirect(new URL("/admin/terms", req.url));
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const list = await prisma.termConfig.findMany({ orderBy: { year: "desc" } });
  return NextResponse.json({ ok: true, data: list });
}
