/**
 * Telefon raqamlar bilan ishlash uchun yordamchi funksiyalar.
 *
 * normalizePhone: kiritilgan qiymatni bo'shliqlardan tozalaydi, xolos.
 * Hech qanday prefiks qo'shilmaydi yoki olib tashlanmaydi.
 */

export const normalizePhone = (phone: string): string => {
  if (!phone) return phone;
  // Faqat bo'shliqlar va tire (-) olib tashlanadi, boshqa o'zgarish yo'q
  return phone.trim().replace(/[\s\-]/g, '');
};

/**
 * Login/qidiruv vaqtida mumkin bo'lgan format variantlarini qaytaradi.
 * Kiritilgan raqamni turli ko'rinishlarda qidirish uchun.
 */
export const phoneVariants = (phone: string): string[] => {
  if (!phone) return [phone];

  const clean = phone.trim().replace(/[\s\-]/g, '');
  const digits = clean.replace(/\D/g, '');

  const variants = new Set<string>([clean]);

  // +998XXXXXXXXX → boshqa formatlar
  if (digits.length === 12 && digits.startsWith('998')) {
    const local = digits.slice(3); // 9 ta raqam
    variants.add(`+998${local}`);
    variants.add(`998${local}`);
    variants.add(`0${local}`);
    variants.add(local);
  }
  // 9 ta raqamli mahalliy raqam
  else if (digits.length === 9) {
    variants.add(digits);
    variants.add(`+998${digits}`);
    variants.add(`998${digits}`);
    variants.add(`0${digits}`);
  }
  // 0XXXXXXXXX (10 raqam)
  else if (digits.length === 10 && digits.startsWith('0')) {
    const local = digits.slice(1);
    variants.add(digits);
    variants.add(local);
    variants.add(`+998${local}`);
    variants.add(`998${local}`);
  }
  // Boshqa har qanday format — kiritilganidek qidirish
  else {
    variants.add(digits);
    if (clean !== digits) variants.add(clean);
  }

  return Array.from(variants);
};
