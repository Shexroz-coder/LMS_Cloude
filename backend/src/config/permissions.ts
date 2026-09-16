/**
 * RUXSATLAR REESTRI
 *
 * Tizimdagi barcha boshqariladigan funksiyalar ro'yxati.
 * `defaults` — har rol uchun standart holat (DB'da yozuv bo'lmasa shu ishlaydi).
 * Admin /admin/permissions sahifasidan istalgan rolga istalgan
 * funksiyani yoqib/o'chirib qo'yishi mumkin (DB'dagi RolePermission ustun).
 *
 * ADMIN har doim hamma narsaga ruxsatli (o'zgartirib bo'lmaydi).
 */

export interface PermissionDef {
  key: string;
  label: string;
  group: string;
  /** Qaysi rollar uchun sozlanadi va standart qiymati */
  defaults: Partial<Record<'TEACHER' | 'STUDENT' | 'PARENT' | 'FOUNDER', boolean>>;
}

export const PERMISSIONS: PermissionDef[] = [
  // ── O'quvchilar ──
  { key: 'students.view',   label: "O'quvchilar ro'yxatini ko'rish",   group: "O'quvchilar", defaults: { TEACHER: true } },
  { key: 'students.edit',   label: "O'quvchi ma'lumotini tahrirlash",  group: "O'quvchilar", defaults: { TEACHER: false } },
  { key: 'students.create', label: "Yangi o'quvchi qo'shish",          group: "O'quvchilar", defaults: { TEACHER: false } },

  // ── Davomat ──
  { key: 'attendance.mark', label: 'Davomat belgilash',                group: 'Davomat', defaults: { TEACHER: true } },
  { key: 'attendance.view', label: "Davomat tarixini ko'rish",         group: 'Davomat', defaults: { TEACHER: true, STUDENT: true, PARENT: true } },

  // ── Coinlar ──
  { key: 'coins.award',     label: 'Coin berish / jarima',             group: 'Coinlar', defaults: { TEACHER: true } },

  // ── Moliya ──
  { key: 'payments.view',   label: "To'lovlarni ko'rish",              group: 'Moliya', defaults: { TEACHER: false, FOUNDER: true } },
  { key: 'payments.create', label: "To'lov qabul qilish",              group: 'Moliya', defaults: { TEACHER: false } },
  { key: 'finance.view',    label: "Moliya hisobotlarini ko'rish",     group: 'Moliya', defaults: { TEACHER: false, FOUNDER: true } },
  { key: 'debtors.view',    label: "Qarzdorlar ro'yxatini ko'rish",    group: 'Moliya', defaults: { TEACHER: true, FOUNDER: true } },
  { key: 'salary.view',     label: "O'z maoshini ko'rish",             group: 'Moliya', defaults: { TEACHER: true } },

  // ── Darslar ──
  { key: 'materials.manage', label: 'Dars materiallari qo\'shish',     group: 'Darslar', defaults: { TEACHER: true } },
  { key: 'schedule.view',    label: "Jadval ko'rish",                  group: 'Darslar', defaults: { TEACHER: true, STUDENT: true, PARENT: true } },
  { key: 'grades.manage',    label: 'Baho qo\'yish',                   group: 'Darslar', defaults: { TEACHER: true } },

  // ── Kommunikatsiya ──
  { key: 'announcements.create', label: "E'lon yuborish",              group: 'Kommunikatsiya', defaults: { TEACHER: false } },
];

/** Standart qiymatni olish: ro'yxatda yo'q kalit yoki rol → false */
export function getDefaultPermission(role: string, permKey: string): boolean {
  if (role === 'ADMIN') return true;
  const def = PERMISSIONS.find(p => p.key === permKey);
  if (!def) return false;
  return def.defaults[role as keyof PermissionDef['defaults']] ?? false;
}
