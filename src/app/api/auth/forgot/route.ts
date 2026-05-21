import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendMail } from "@/lib/mailer";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") || "").trim();
  if (!email) return NextResponse.json({ ok: false, error: "邮箱必填" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ ok: true }); // 避免枚举用户

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30m
  await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const link = `${baseUrl}/reset/${token}`;
  const html = `<p>请点击以下链接重置密码（30分钟内有效）：</p><p><a href="${link}">${link}</a></p>`;
  const res = await sendMail(email, "重置密码", html);
  if (!(res as any).ok) {
    // 邮件未配置时，为方便开发返回 token
    return NextResponse.json({ ok: true, token, warn: "SMTP 未配置，返回 token 供调试" });
  }
  return NextResponse.json({ ok: true });
}


