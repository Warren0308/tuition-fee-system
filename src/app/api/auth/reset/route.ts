import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const form = await req.formData();
  const token = String(form.get("token") || "");
  const password = String(form.get("password") || "");
  const confirm = String(form.get("confirm") || "");
  if (!token || !password || password !== confirm) return NextResponse.json({ ok: false, error: "参数错误" }, { status: 400 });
  const rec = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!rec || rec.usedAt || rec.expiresAt < new Date()) return NextResponse.json({ ok: false, error: "重置链接无效或已过期" }, { status: 400 });
  const hash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: rec.userId }, data: { passwordHash: hash, mustChangePassword: false } }),
    prisma.passwordResetToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
  ]);
  return NextResponse.redirect(new URL("/login", req.url));
}


