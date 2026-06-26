/**
 * Telefon raqamlar bilan ishlash uchun yordamchi funksiyalar.
 *
 * Standart saqlash formati: +998XXXXXXXXX (9 ta raqam, +998 prefiksi bilan)
 */

/**
 * Har qanday formatdagi telefon raqamni standart +998XXXXXXXXX formatga keltiradi.
 * Masalan:
 *   "901234567"        → "+998901234567"
 *   "0901234567"       → "+998901234567"
 *   "998901234567"     → "+998901234567"
 *   "+998 90 123 45 67"→ "+998901234567"
 */
export const normalizePhone = (phone: string): string => {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, '');

  let local = digits;
  // Faqat aniq 12 raqamli bo'lsa 998 country code sifatida olib tashlanadi
  // (998 + 9 ta mahalliy raqam = 12).
  // 9 ta raqamli "998XXXXXX" mahalliy raqam (99-operatori) noto'g'ri kesib
  // tashlanmasligi uchun bu shart zarur.
  if (digits.startsWith('998') && digits.length === 12) {
    local = digits.slice(3);
  } else if (digits.startsWith('0') && digits.length === 10) {
    local = digits.slice(1);
  }
  // Oxirgi 9 ta raqamni olish (mahalliy raqam doim 9 xonali)
  local = local.slice(-9);

  return `+998${local}`;
};

/**
 * Login/qidiruv vaqtida eski (normalizatsiyadan oldin saqlangan) yozuvlarni
 * ham topish uchun mumkin bo'lgan barcha format variantlarini qaytaradi.
 */
export const phoneVariants = (phone: string): string[] => {
  if (!phone) return [phone];
  const digits = phone.replace(/\D/g, '');

  let local = digits;
  if (digits.startsWith('998') && digits.length === 12) {
    local = digits.slice(3);
  } else if (digits.startsWith('0') && digits.length === 10) {
    local = digits.slice(1);
  }
  local = local.slice(-9);

  return Array.from(new Set([
    `+998${local}`,
    `998${local}`,
    `0${local}`,
    local,
    phone, // original kiritilgan qiymat ham (ehtiyot uchun)
  ]));
};
