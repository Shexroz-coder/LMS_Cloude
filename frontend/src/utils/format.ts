/**
 * Umumiy formatlagichlar — butun ilova bo'ylab bir xil ko'rinish uchun.
 * Avval 28+ faylда takrorlangan edi.
 */

/** Pulни uz-UZ ko'rinishida (butun son, "so'm"siz): 1250000 → "1 250 000" */
export const formatMoney = (v: number | string | null | undefined): string =>
  new Intl.NumberFormat('uz-UZ').format(Math.round(Number(v) || 0));

/** Pulни "so'm" bilan: "1 250 000 so'm" */
export const formatSom = (v: number | string | null | undefined): string =>
  `${formatMoney(v)} so'm`;

/** Ixcham pul (mobilга): 1250000 → "1.25 mln", 3.4e9 → "3.4 mlrd" */
export const fmtShort = (v: number | string | null | undefined): string => {
  const n = Math.round(Number(v) || 0);
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '') + ' mlrd';
  if (a >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + ' mln';
  if (a >= 1_000) return (n / 1_000).toFixed(1).replace(/\.?0+$/, '') + ' ming';
  return String(n);
};

/** Sana: uz-UZ qisqa ko'rinish */
export const fmtDate = (d: string | number | Date | null | undefined): string => {
  if (!d) return '—';
  const date = new Date(d);
  return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('uz-UZ');
};
