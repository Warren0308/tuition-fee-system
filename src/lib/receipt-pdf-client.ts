/**
 * 客户端：收据 DOM → PDF → WhatsApp 分享
 *
 * - 手机：系统分享直接附带 PDF 文件（无需下载）
 * - 电脑：PDF 上传服务器 → 跳转 WhatsApp Web（预填 PDF 链接，点发送即可；无需本地下载）
 */
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp-share";

export async function generateReceiptPdfBlob(
  element: HTMLElement
): Promise<Blob> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  let imgWidth = contentWidth;
  let imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight > pageHeight - margin * 2) {
    imgHeight = pageHeight - margin * 2;
    imgWidth = (canvas.width * imgHeight) / canvas.height;
  }

  const x = (pageWidth - imgWidth) / 2;
  pdf.addImage(imgData, "PNG", x, margin, imgWidth, imgHeight);

  const arrayBuffer = pdf.output("arraybuffer");
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error("PDF 生成失败");
  }
  return new Blob([arrayBuffer], { type: "application/pdf" });
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function canSharePdfFile(file: File): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.share &&
    (!navigator.canShare || navigator.canShare({ files: [file] }))
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (!base64) reject(new Error("PDF 编码失败"));
      else resolve(base64);
    };
    reader.onerror = () => reject(new Error("PDF 读取失败"));
    reader.readAsDataURL(blob);
  });
}

async function uploadReceiptPdf(
  paymentId: string,
  blob: Blob,
  filename: string
): Promise<{ shareUrl: string; token: string }> {
  if (blob.size === 0) {
    throw new Error("PDF 生成失败（文件为空）");
  }

  const safeName = filename.replace(/[^\w.\-]/g, "_");
  const pdfBase64 = await blobToBase64(blob);

  const res = await fetch(`/api/billing/receipt/${paymentId}/pdf-share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pdfBase64, filename: safeName }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "上传 PDF 失败");
  }

  return res.json();
}

function openWhatsAppWithPdfLink(phone: string, pdfUrl: string) {
  // WhatsApp 无法通过 URL 预附 PDF 文件，只能预填 PDF 在线链接
  window.open(buildWhatsAppShareUrl(phone, pdfUrl), "_blank", "noopener,noreferrer");
}

export type ShareReceiptResult = {
  ok: boolean;
  method: "native-share" | "whatsapp-link" | "api";
  message?: string;
};

/**
 * 分享到 WhatsApp（尽量不让用户在本地找 PDF 文件）
 */
export async function shareReceiptPdfToWhatsApp(opts: {
  paymentId: string;
  elementId: string;
  filename: string;
  guardianPhone: string;
}): Promise<ShareReceiptResult> {
  const el = document.getElementById(opts.elementId);
  if (!el) {
    return { ok: false, method: "whatsapp-link", message: "找不到收据内容" };
  }

  const blob = await generateReceiptPdfBlob(el);
  const file = new File([blob], opts.filename, { type: "application/pdf" });

  // ① 手机 / 支持文件分享：直接弹出分享面板 → 选 WhatsApp → PDF 已附上
  if (isMobileDevice() && canSharePdfFile(file)) {
    try {
      await navigator.share({
        files: [file],
        title: opts.filename.replace(/\.pdf$/i, ""),
      });
      return {
        ok: true,
        method: "native-share",
        message: "请在分享面板选择 WhatsApp，PDF 已准备好，点发送即可",
      };
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return { ok: false, method: "native-share", message: "已取消分享" };
      }
    }
  }

  // ② 上传 PDF 到服务器（不在本地下载）
  const { shareUrl, token } = await uploadReceiptPdf(
    opts.paymentId,
    blob,
    opts.filename
  );

  // ③ 若配置了 WhatsApp API，服务端直接发 PDF 文件
  try {
    const apiRes = await fetch(
      `/api/billing/receipt/${opts.paymentId}/whatsapp-pdf`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          phone: opts.guardianPhone,
        }),
      }
    );
    const apiData = await apiRes.json();
    if (apiData.success) {
      return {
        ok: true,
        method: "api",
        message: "PDF 已直接发送到家长 WhatsApp",
      };
    }
  } catch {
    // API 未配置或失败 → 走链接跳转
  }

  // ④ 电脑 / 无 API：跳转 WhatsApp，预填 PDF 链接（家长点开即看 PDF，收费员只需点发送）
  openWhatsAppWithPdfLink(opts.guardianPhone, shareUrl);

  return {
    ok: true,
    method: "whatsapp-link",
    message: isMobileDevice()
      ? "已打开 WhatsApp，请点发送。家长收到链接后可直接查看 PDF 收据"
      : "已打开 WhatsApp Web，请点发送。家长收到链接后可直接查看 PDF（无需您下载文件）",
  };
}
