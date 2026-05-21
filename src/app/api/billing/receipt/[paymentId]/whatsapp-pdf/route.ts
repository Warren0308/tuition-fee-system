import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl, getReceiptPdfShare } from "@/lib/receipt-pdf-share";
import { sendWhatsAppDocument } from "@/lib/notifications";

/** 通过 WhatsApp Business API 发送已上传的 PDF 收据 */
export async function POST(
  req: Request,
  { params }: { params: { paymentId: string } }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const token = String(body.token || "");
  const phone = String(body.phone || "");

  if (!token || !phone) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }

  const share = await getReceiptPdfShare(token);
  if (!share || share.paymentId !== params.paymentId) {
    return NextResponse.json({ error: "PDF 链接无效或已过期" }, { status: 404 });
  }

  const publicUrl = `${getPublicAppUrl()}/api/billing/receipt/share/${token}`;

  const payment = await prisma.studentTermPayment.findUnique({
    where: { id: params.paymentId },
    include: { student: true },
  });

  const docResult = await sendWhatsAppDocument(phone, publicUrl, share.filename);

  await prisma.notification.create({
    data: {
      channel: "WHATSAPP",
      target: phone,
      subject: `收据 PDF - ${payment?.student.fullName || ""}`,
      body: publicUrl,
      status: docResult.success ? "SENT" : "FAILED",
      sentAt: docResult.success ? new Date() : null,
      error: docResult.error,
    },
  });

  if (docResult.success) {
    return NextResponse.json({
      success: true,
      message: "PDF 收据已通过 WhatsApp 发送",
      messageId: docResult.messageId,
    });
  }

  return NextResponse.json(
    {
      success: false,
      error: docResult.error || "WhatsApp API 发送失败",
      shareUrl: publicUrl,
    },
    { status: 502 }
  );
}
