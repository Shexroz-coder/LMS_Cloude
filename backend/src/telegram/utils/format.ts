/**
 * Valyuta, sana, status formatlash uchun yordamchi funksiyalar
 */

/** So'mni formatlash: 1500000 → "1 500 000 so'm" */
export function formatMoney(amount: number | null | undefined): string {
  if (!amount && amount !== 0) return '0 so\'m';
  return Math.round(amount).toLocaleString('ru-RU').replace(/,/g, ' ') + ' so\'m';
}

/** Sanani formatlash: 2026-03-07 → "07.03.2026" */
export function formatDate(date: Date | string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/** Sanani qisqa formatlash: "07-Mar" */
export function formatDateShort(date: Date | string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  const months = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
  return `${d.getDate()}-${months[d.getMonth()]}`;
}

/** Oy nomini olish: 2026-03 → "Mart 2026" */
export function formatMonth(year: number, month: number): string {
  const months = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
  ];
  return `${months[month]} ${year}`;
}

/** Vaqtni formatlash: "14:30" */
export function formatTime(time: string | null): string {
  if (!time) return '—';
  return time.slice(0, 5);
}

/** Davomat status emoji */
export function attendanceEmoji(status: string): string {
  switch (status) {
    case 'PRESENT': return '✅';
    case 'ABSENT': return '❌';
    case 'LATE': return '⏰';
    case 'EXCUSED': return '📋';
    default: return '❓';
  }
}

/** Davomat status nomi */
export function attendanceLabel(status: string): string {
  switch (status) {
    case 'PRESENT': return 'Keldi';
    case 'ABSENT': return 'Kelmadi';
    case 'LATE': return 'Kechikdi';
    case 'EXCUSED': return 'Sababli';
    default: return status;
  }
}

/** To'lov usuli formatlash */
export function paymentMethodLabel(method: string): string {
  switch (method) {
    case 'CASH': return '💵 Naqd';
    case 'CARD': return '💳 Karta';
    case 'PAYME': return '📱 Payme';
    case 'UZUM': return '📱 Uzum';
    case 'TRANSFER': return '🏦 O\'tkazma';
    default: return method;
  }
}

/** Hafta kuni nomi */
export function dayName(day: number): string {
  const names = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
  return names[day] || '—';
}

/** Hafta kuni qisqa nomi */
export function dayNameShort(day: number): string {
  const names = ['Yak', 'Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha'];
  return names[day] || '—';
}

/** Progress bar yaratish: ████████░░ 80% */
export function progressBar(percent: number, length = 10): string {
  const filled = Math.round((percent / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/** Reyting emoji: 1 → 🥇, 2 → 🥈, 3 → 🥉, 4+ → raqam */
export function rankEmoji(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}.`;
}

/** Notification turi emoji */
export function notificationEmoji(type: string): string {
  switch (type) {
    case 'PAYMENT': return '💰';
    case 'ATTENDANCE': return '✅';
    case 'GRADE': return '📊';
    case 'ANNOUNCEMENT': return '📢';
    case 'COIN': return '🪙';
    case 'SYSTEM': return '⚙️';
    default: return '🔔';
  }
}

// ══════════════════════════════════════════════════════
//  🤖 ROBOTIC EDU — BREND ELEMENTLARI
// ══════════════════════════════════════════════════════
const BRAND_NAME = 'Robotic Edu';
const BRAND_ICON = '🤖';
const BRAND_LINE = `${BRAND_ICON} <b>${BRAND_NAME}</b>`;
const BRAND_FOOTER_TEXT = `⚡ ${BRAND_NAME} LMS`;

/** Brendli sahifa sarlavhasi */
export function brandHeader(icon: string, title: string, subtitle?: string): string {
  let h = `╔══════════════════════════╗\n`;
  h += `  ${BRAND_LINE}\n`;
  h += `  ${icon} <b>${title}</b>\n`;
  if (subtitle) h += `  ${subtitle}\n`;
  h += `╚══════════════════════════╝\n\n`;
  return h;
}

/** Brendli sahifa pastki qismi */
export function brandFooter(): string {
  return `\n━━━━━━━━━━━━━━━━━━━━━━━\n<i>${BRAND_FOOTER_TEXT}</i>`;
}

/** Brend nomi (oddiy string) */
export function getBrandName(): string {
  return BRAND_NAME;
}

/** Escape special chars for Telegram HTML */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
