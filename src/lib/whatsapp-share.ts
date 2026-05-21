/**
 * WhatsApp 分享链接（wa.me）— 无需 Meta Business API
 * 系统生成文案 → 跳转 WhatsApp App/网页 → 收费员点发送
 */

import { normalizeMalaysiaPhone } from "@/lib/phone-utils";
export { normalizeMalaysiaPhone };

/** 构建 WhatsApp 分享 URL；message 为空则只打开对话（用于手动发 PDF） */
export function buildWhatsAppShareUrl(phone: string | undefined, message?: string): string {
  const text = message?.trim() ? encodeURIComponent(message) : "";
  if (phone?.trim()) {
    const normalized = normalizeMalaysiaPhone(phone.trim());
    return text ? `https://wa.me/${normalized}?text=${text}` : `https://wa.me/${normalized}`;
  }
  return text ? `https://wa.me/?text=${text}` : "https://wa.me/";
}

export function formatReceiptMoney(cents: number): string {
  return `RM ${(cents / 100).toFixed(2)}`;
}

export function generateReceiptMessage(data: {
  studentName: string;
  gradeName: string;
  termLabel: string;
  items: Array<{ description: string; finalCents: number; note?: string | null }>;
  total: number;
  paidAt: Date | null;
  receiptId: string;
}): string {
  const lines = [
    `🧾 *优特学院收据*`,
    ``,
    `👤 学生: ${data.studentName}`,
    `📚 年级: ${data.gradeName}`,
    `📅 学期: ${data.termLabel}`,
    ``,
    `*费用明细:*`,
  ];

  for (const item of data.items) {
    let line = `• ${item.description}: ${formatReceiptMoney(item.finalCents)}`;
    if (item.note) line += ` _(${item.note})_`;
    lines.push(line);
  }

  lines.push(``);
  lines.push(`*总计: ${formatReceiptMoney(data.total)}*`);
  lines.push(``);
  lines.push(`状态: ${data.paidAt ? "✅ 已开收据" : "⏳ 待付款"}`);
  lines.push(`收据编号: ${data.receiptId.slice(0, 8).toUpperCase()}`);
  lines.push(``);
  lines.push(`感谢您的付款！如有疑问请联系学院。`);

  return lines.join("\n");
}

export function generateUnpaidReminderMessage(data: {
  studentName: string;
  gradeName: string;
  termLabel: string;
  unpaidItems: Array<{ name: string; price: number }>;
  totalUnpaid: number;
}): string {
  const lines = [
    `📢 *优特学院缴费提醒*`,
    ``,
    `👤 学生: ${data.studentName}`,
    `📚 年级: ${data.gradeName}`,
    `📅 学期: ${data.termLabel}`,
    ``,
    `*未付项目:*`,
  ];

  for (const item of data.unpaidItems) {
    lines.push(`• ${item.name}: ${formatReceiptMoney(item.price)}`);
  }

  lines.push(``);
  lines.push(`*待付总额: ${formatReceiptMoney(data.totalUnpaid)}*`);
  lines.push(``);
  lines.push(`请尽快联系学院完成缴费，谢谢！`);

  return lines.join("\n");
}
