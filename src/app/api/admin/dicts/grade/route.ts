import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const form = await req.formData();
  const name = String(form.get("name") || "").trim();
  const orderIndex = Number(form.get("orderIndex") || 0);
  if (!name) return NextResponse.json({ ok: false, error: "名称必填" }, { status: 400 });
  await prisma.grade.create({ data: { name, orderIndex } });
  return NextResponse.redirect(new URL("/admin/catalog/dicts", req.url));
}


