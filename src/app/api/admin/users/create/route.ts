import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const form = await req.formData();
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "").trim();
  const roleCode = String(form.get("roleCode") || "").trim();
  if (!username || !password || !roleCode) return NextResponse.json({ ok: false, error: "参数不完整" }, { status: 400 });
  const role = await prisma.role.findUnique({ where: { code: roleCode as any } });
  if (!role) return NextResponse.json({ ok: false, error: "角色不存在" }, { status: 400 });
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { username, passwordHash, roles: { create: [{ roleId: role.id }] } } });
  return NextResponse.redirect(new URL("/admin/users", req.url));
}


