import { prisma } from "@/lib/prisma";

const TTL_HOURS = 72;

export function getPublicAppUrl(fallbackOrigin?: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    fallbackOrigin ||
    "http://localhost:3000";
  return base.replace(/\/$/, "");
}

/** 保存收据 PDF，返回公开访问 token */
export async function storeReceiptPdfShare(
  paymentId: string,
  data: Buffer,
  filename: string
): Promise<{ token: string; shareUrl: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000);

  await prisma.receiptPdfShare.deleteMany({ where: { paymentId } });

  const row = await prisma.receiptPdfShare.create({
    data: {
      paymentId,
      data,
      filename,
      expiresAt,
    },
  });

  const shareUrl = `${getPublicAppUrl()}/api/billing/receipt/share/${row.token}`;

  return { token: row.token, shareUrl, expiresAt };
}

export async function getReceiptPdfShare(token: string) {
  const row = await prisma.receiptPdfShare.findUnique({ where: { token } });
  if (!row || row.expiresAt < new Date()) return null;
  return row;
}

/** 清理过期 PDF 缓存 */
export async function purgeExpiredReceiptPdfShares() {
  await prisma.receiptPdfShare.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}
