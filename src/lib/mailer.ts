import nodemailer from "nodemailer";

export function getSmtpTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) return null;
  const secure = Number(process.env.SMTP_SECURE ?? "1") === 1; // 1=true 0=false
  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

export async function sendMail(to: string, subject: string, html: string) {
  try {
    const transport = getSmtpTransport();
    if (!transport) return { ok: false, error: "SMTP 未配置" } as const;
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@example.com";
    await transport.sendMail({ from, to, subject, html });
    return { ok: true } as const;
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) } as const;
  }
}


