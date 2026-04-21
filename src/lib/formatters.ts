import { format, formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

/**
 * Format number as Thai Baht currency
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '฿0';

  const num = typeof amount === 'string' ? parseFloat(amount) : amount;

  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format number with thousand separators
 */
export function formatNumber(num: number | string | null | undefined): string {
  if (num === null || num === undefined) return '0';

  const value = typeof num === 'string' ? parseFloat(num) : num;

  return new Intl.NumberFormat('th-TH').format(value);
}

/**
 * Format date in Thai format
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';

  const d = typeof date === 'string' ? new Date(date) : date;

  return format(d, 'd MMM yyyy', { locale: th });
}

/**
 * Format date with time
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-';

  const d = typeof date === 'string' ? new Date(date) : date;

  return format(d, 'd MMM yyyy HH:mm', { locale: th });
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return '-';

  const d = typeof date === 'string' ? new Date(date) : date;

  return formatDistanceToNow(d, { addSuffix: true, locale: th });
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

/**
 * Parse currency string to number
 */
export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[^\d.-]/g, '')) || 0;
}

/**
 * Convert number to Thai Baht text (Amount in words)
 */
export function bahtText(num: number): string {
  const numInt = Math.floor(Math.abs(num));
  const numDec = Math.round((Math.abs(num) - numInt) * 100);

  const t1 = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const t2 = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

  const convert = (n: number) => {
    let res = "";
    const s = n.toString();
    for (let i = 0; i < s.length; i++) {
      const d = parseInt(s[i]);
      if (d !== 0) {
        if (i === s.length - 1 && d === 1 && s.length > 1) res += "เอ็ด";
        else if (i === s.length - 2 && d === 2) res += "ยี่";
        else if (i === s.length - 2 && d === 1) res += "";
        else res += t1[d];
        res += t2[s.length - i - 1];
      }
    }
    return res;
  };

  let result = convert(numInt) + "บาท";
  if (numDec === 0) result += "ถ้วน";
  else result += convert(numDec) + "สตางค์";

  if (num < 0) result = "ลบ" + result;
  if (numInt === 0 && numDec === 0) return "ศูนย์บาทถ้วน";

  return result;
}
