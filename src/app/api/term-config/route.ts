import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const form = await req.formData();
  const year = Number(form.get("year"));
  const term1Date = form.get("term1Date") as string;
  if (!year || !term1Date) return NextResponse.json({ ok: false, error: "参数不完整" }, { status: 400 });
  await prisma.termConfig.upsert({
    where: { year },
    update: { term1Date: new Date(term1Date) },
    create: { year, term1Date: new Date(term1Date) },
  });
  return NextResponse.redirect(new URL("/admin/terms", req.url));
}

export async function GET() {
  const list = await prisma.termConfig.findMany({ orderBy: { year: "desc" } });
  return NextResponse.json({ ok: true, data: list });
}
