import { NextResponse } from "next/server";
import { getReceiptPdfShare } from "@/lib/receipt-pdf-share";

export const runtime = "nodejs";

/** 公开访问收据 PDF（72 小时内有效） */
export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const row = await getReceiptPdfShare(params.token);
  if (!row) {
    return NextResponse.json({ error: "链接已失效或不存在" }, { status: 404 });
  }

  return new NextResponse(row.data, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(row.filename)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
