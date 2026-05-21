import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { storeReceiptPdfShare } from "@/lib/receipt-pdf-share";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

function safeFilename(raw: string | null | undefined, paymentId: string): string {
  const base = raw?.trim() || `receipt-${paymentId.slice(0, 8)}`;
  const ascii = base.replace(/[^\w.\-]/g, "_");
  return ascii.endsWith(".pdf") ? ascii : `${ascii}.pdf`;
}

/** 上传收据 PDF，返回可公开访问的链接（供 WhatsApp 跳转发送） */
export async function POST(
  req: Request,
  { params }: { params: { paymentId: string } }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const payment = await prisma.studentTermPayment.findUnique({
    where: { id: params.paymentId },
  });
  if (!payment) {
    return NextResponse.json({ error: "收据不存在" }, { status: 404 });
  }

  const contentType = req.headers.get("content-type") || "";
  let buffer: Buffer | null = null;
  let filename = safeFilename(null, params.paymentId);

  if (contentType.includes("application/json")) {
    const body = await req.json();
    const b64 = String(body.pdfBase64 || "");
    filename = safeFilename(body.filename, params.paymentId);
    if (b64) buffer = Buffer.from(b64, "base64");
  } else {
    const form = await req.formData();
    filename = safeFilename(form.get("filename") as string | null, params.paymentId);
    const file = form.get("file");
    if (file != null && typeof file !== "string") {
      buffer = Buffer.from(await (file as Blob).arrayBuffer());
    }
  }

  if (!buffer || buffer.length === 0) {
    return NextResponse.json(
      { error: "PDF 生成失败或上传为空，请刷新页面后重试" },
      { status: 400 }
    );
  }

  if (buffer.length > MAX_BYTES) {
    return NextResponse.json(
      { error: "PDF 过大（最大 5MB）" },
      { status: 400 }
    );
  }

  // 简单校验 PDF 魔数
  if (buffer.subarray(0, 4).toString() !== "%PDF") {
    return NextResponse.json(
      { error: "PDF 格式无效，请刷新页面后重试" },
      { status: 400 }
    );
  }

  try {
    const { token, shareUrl, expiresAt } = await storeReceiptPdfShare(
      params.paymentId,
      buffer,
      filename
    );

    return NextResponse.json({
      token,
      shareUrl,
      expiresAt: expiresAt.toISOString(),
      filename,
    });
  } catch (e) {
    console.error("storeReceiptPdfShare failed:", e);
    return NextResponse.json(
      { error: "保存 PDF 失败，请确认数据库已更新（ReceiptPdfShare 表）" },
      { status: 500 }
    );
  }
}
