/**
 * Umumiy konstantalar — takrorni kamaytirish uchun.
 * (Hafta kunlari, guruh statusi, to'lov usullari.)
 */

// Hafta kunlari — indeks 0=Yakshanba ... 6=Shanba (daysOfWeek bilan mos)
export const DAYS = ['Yak', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
export const DAYS_FULL = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

// Guruh statusi
export const GROUP_STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE:    { label: 'Faol',          cls: 'bg-emerald-100 text-emerald-700' },
  PAUSED:    { label: "To'xtatilgan",  cls: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: 'Tugagan',       cls: 'bg-gray-100 text-gray-600' },
};

// To'lov usullari
export const PAYMENT_METHODS: Record<string, string> = {
  CASH: 'Naqd', CARD: 'Karta', TRANSFER: "O'tkazma", ONLINE: 'Online',
};
