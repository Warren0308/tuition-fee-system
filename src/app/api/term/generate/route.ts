import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const year = Number(form.get("year"));
  if (!year) return NextResponse.json({ ok: false, error: "学年必填" }, { status: 400 });

  // 默认 Term1 = 年头第一周（按周一对齐），若存在 TermConfig 则采用配置日
  const cfg = await prisma.termConfig.findUnique({ where: { year } });
  let term1 = cfg?.term1Date ?? new Date(`${year}-01-01T00:00:00Z`);
  // 规范化到周一
  const weekday = term1.getUTCDay(); // 0=Sun,1=Mon
  const offsetToMon = ((weekday + 6) % 7); // 周一=0
  term1 = addDays(new Date(Date.UTC(term1.getUTCFullYear(), term1.getUTCMonth(), term1.getUTCDate())), -offsetToMon);

  // 生成 13 个学期：每个 4 周（28 天）；结束日 = start + 27 天
  const terms = Array.from({ length: 13 }).map((_, i) => {
    const startDate = addDays(term1, 28 * i);
    const endDate = addDays(startDate, 27);
    return { year, termIndex: i + 1, startDate, endDate };
  });

  // 覆盖写入（幂等）：逐条 upsert
  for (const t of terms) {
    await prisma.term.upsert({
      where: { year_termIndex: { year: t.year, termIndex: t.termIndex } },
      update: { startDate: t.startDate, endDate: t.endDate },
      create: t,
    });
  }

  return NextResponse.redirect(new URL("/admin/terms", req.url));
}


