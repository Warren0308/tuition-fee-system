import { NextResponse } from "next/server";
import { sendMail } from "@/lib/mailer";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const to = String(form.get("to") || "").trim();
    const subject = String(form.get("subject") || "测试邮件");
    const body = String(form.get("body") || "这是一封测试邮件。");
    if (!to) return NextResponse.json({ ok: false, error: "收件人必填" }, { status: 400 });
    const html = `<p>${body}</p>`;
    const res = await sendMail(to, subject, html);
    if (!(res as any).ok) return NextResponse.json(res, { status: 400 });
    return NextResponse.redirect(new URL("/admin/tools", req.url));
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}



