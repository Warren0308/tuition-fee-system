import { NextResponse } from "next/server";
import { sendMail } from "@/lib/mailer";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const form = await req.formData();
    const email = String(form.get("email") || "").trim();
    const subject = "邮件功能测试 - 优特补习学院";
    const body = `
      <h2>邮件功能测试</h2>
      <p>这是一封来自优特补习学院学费管理系统的测试邮件。</p>
      <p>如果您收到这封邮件，说明系统邮件功能运行正常。</p>
      <p>发送时间：${new Date().toLocaleString('zh-CN')}</p>
      <hr/>
      <p><small>此邮件由系统自动发送，请勿回复。</small></p>
    `;
    
    if (!email) return NextResponse.json({ ok: false, error: "收件人必填" }, { status: 400 });
    
    const res = await sendMail(email, subject, body);
    if (!(res as any).ok) return NextResponse.json(res, { status: 400 });
    
    return NextResponse.redirect(new URL("/admin/tools?success=mail-sent", req.url));
  } catch (err: any) {
    console.error("邮件发送失败:", err);
    return NextResponse.redirect(new URL("/admin/tools?error=mail-failed", req.url));
  }
}



