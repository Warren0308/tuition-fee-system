"use client";

import { useState } from "react";
import { shareReceiptPdfToWhatsApp } from "@/lib/receipt-pdf-client";

interface Props {
  paymentId: string;
  studentName: string;
  guardianPhone?: string;
  guardianName?: string;
}

export function ReceiptActions({
  paymentId,
  studentName,
  guardianPhone,
  guardianName,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const filename = `receipt-${paymentId.slice(0, 8)}.pdf`;

  const handleShareWhatsApp = async () => {
    if (!guardianPhone) {
      setHint("请先添加主监护人电话");
      return;
    }

    setBusy(true);
    setHint(null);

    try {
      const result = await shareReceiptPdfToWhatsApp({
        paymentId,
        elementId: "receipt-document",
        filename,
        guardianPhone,
      });
      setHint(result.message || (result.ok ? "完成" : "分享失败"));
    } catch (e) {
      setHint(e instanceof Error ? e.message : "生成或分享失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-3 justify-end">
        <button
          onClick={() => window.print()}
          className="btn-modern bg-green-600 hover:bg-green-700 text-white px-4 py-2 flex items-center gap-2"
        >
          <span>🖨️</span>
          <span>打印 / 存 PDF</span>
        </button>

        <button
          onClick={handleShareWhatsApp}
          disabled={busy || !guardianPhone}
          className="btn-modern bg-green-500 hover:bg-green-600 text-white px-4 py-2 flex items-center gap-2 disabled:opacity-50"
        >
          <span>📱</span>
          <span>{busy ? "准备中…" : "WhatsApp 发 PDF"}</span>
        </button>

        <a
          href={`/billing/edit/${paymentId}`}
          className="btn-modern bg-orange-100 text-orange-600 px-4 py-2 hover:bg-orange-200 flex items-center gap-2"
        >
          <span>✏️</span>
          <span>修改账单</span>
        </a>
      </div>

      <p className="text-xs text-gray-500 text-right max-w-md">
        打印：选打印机出纸，或选「另存为 PDF」保存到电脑。
        {guardianPhone ? (
          <>
            {" "}
            WhatsApp：发给 {guardianName}（{guardianPhone}）。
          </>
        ) : (
          <span className="text-amber-600"> 发 WhatsApp 需先添加主监护人电话。</span>
        )}
      </p>

      {hint && (
        <p
          className={`text-xs text-right max-w-md px-2 py-1 rounded ${
            hint.includes("失败") || hint.includes("取消")
              ? "bg-red-50 text-red-700"
              : "bg-blue-50 text-blue-700"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
