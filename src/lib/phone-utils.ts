/**
 * 格式化马来西亚电话号码
 * 0123456789 -> 60123456789
 * +60123456789 -> 60123456789
 * 60123456789 -> 60123456789
 */
export function normalizeMalaysiaPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  if (cleaned.startsWith("0")) cleaned = "60" + cleaned.slice(1);
  else if (!cleaned.startsWith("60")) cleaned = "60" + cleaned;
  return cleaned;
}
