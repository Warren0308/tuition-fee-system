import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  const userId = (session as any).userId as string;

  const form = await req.formData();
  const username = String(form.get("username") || "").trim();
  const email = String(form.get("email") || "").trim() || null;
  const phone = String(form.get("phone") || "").trim() || null;
  const avatarUrl = String(form.get("avatarUrl") || "").trim() || null;
  const currentPassword = String(form.get("currentPassword") || "");
  const newPassword = String(form.get("newPassword") || "");
  const confirmPassword = String(form.get("confirmPassword") || "");

  if (!username) return NextResponse.json({ ok: false, error: "用户名必填" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ ok: false, error: "用户不存在" }, { status: 404 });

  const data: any = { username, email, phone, avatarUrl };

  if (newPassword || confirmPassword) {
    if (!currentPassword) return NextResponse.json({ ok: false, error: "请填写当前密码" }, { status: 400 });
    if (newPassword !== confirmPassword) return NextResponse.json({ ok: false, error: "两次新密码不一致" }, { status: 400 });
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return NextResponse.json({ ok: false, error: "当前密码错误" }, { status: 400 });
    data.passwordHash = await bcrypt.hash(newPassword, 10);
    data.mustChangePassword = false;
  }

  await prisma.user.update({ where: { id: userId }, data });
  return NextResponse.redirect(new URL("/profile", req.url));
}


