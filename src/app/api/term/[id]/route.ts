import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) return NextResponse.json({ ok: false, error: "参数错误" }, { status: 400 });
  const form = await req.formData();
  const startDateStr = String(form.get("startDate") || "");
  if (!startDateStr) return NextResponse.json({ ok: false, error: "开始日期必填" }, { status: 400 });
  const startDate = new Date(startDateStr);
  // endDate = startDate + 27 天
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 27);

  await prisma.term.update({ where: { id }, data: { startDate, endDate } });
  return NextResponse.redirect(new URL("/admin/terms", req.url));
}


