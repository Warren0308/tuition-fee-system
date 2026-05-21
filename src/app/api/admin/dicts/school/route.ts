import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const form = await req.formData();
  const name = String(form.get("name") || "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "名称必填" }, { status: 400 });
  await prisma.school.create({ data: { name } });
  return NextResponse.redirect(new URL("/admin/catalog/dicts", req.url));
}


