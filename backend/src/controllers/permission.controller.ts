/**
 * RUXSATLAR BOSHQARUVI
 *
 * Admin: rollar uchun funksiyalarni yoqish/o'chirish matritsasi.
 * Har foydalanuvchi: o'zining amaldagi ruxsatlarini olish (frontend gating).
 */
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';
import { PERMISSIONS, getDefaultPermission } from '../config/permissions';
import { invalidatePermissionCache, hasPermission } from '../middleware/permission.middleware';
import { hashPassword } from '../utils/password.utils';
import { normalizePhone } from '../utils/phone.utils';

const p = prisma as any;
const CONFIGURABLE_ROLES = ['TEACHER', 'STUDENT', 'PARENT', 'FOUNDER'] as const;

// ══════════════════════════════════════════════
// GET /permissions — To'liq matritsa (ADMIN)
// ══════════════════════════════════════════════
export const getPermissionMatrix = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    let overrides: Array<{ role: string; permKey: string; allowed: boolean }> = [];
    try {
      overrides = await p.rolePermission.findMany();
    } catch { /* jadval hali yo'q */ }

    const overrideMap = new Map(overrides.map(o => [`${o.role}:${o.permKey}`, o.allowed]));

    const matrix = PERMISSIONS.map(def => ({
      key: def.key,
      label: def.label,
      group: def.group,
      roles: Object.fromEntries(
        CONFIGURABLE_ROLES.map(role => {
          const override = overrideMap.get(`${role}:${def.key}`);
          return [role, {
            allowed: override !== undefined ? override : getDefaultPermission(role, def.key),
            isDefault: override === undefined,
            configurable: role in def.defaults || override !== undefined,
          }];
        })
      ),
    }));

    sendSuccess(res, { matrix, roles: CONFIGURABLE_ROLES });
  } catch (err) {
    console.error('getPermissionMatrix error:', err);
    sendError(res, 'Ruxsatlarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// PUT /permissions — Ruxsatni o'zgartirish (ADMIN)
// body: { role, permKey, allowed }
// ══════════════════════════════════════════════
export const setPermission = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, permKey, allowed } = req.body;
    if (!role || !permKey || allowed === undefined) {
      sendError(res, 'role, permKey va allowed kiritilishi shart.', 400);
      return;
    }
    if (role === 'ADMIN') {
      sendError(res, 'ADMIN ruxsatlarini o\'zgartirib bo\'lmaydi.', 400);
      return;
    }
    if (!PERMISSIONS.some(pd => pd.key === permKey)) {
      sendError(res, 'Noma\'lum ruxsat kaliti.', 400);
      return;
    }

    await p.rolePermission.upsert({
      where: { role_permKey: { role, permKey } },
      update: { allowed: Boolean(allowed) },
      create: { role, permKey, allowed: Boolean(allowed) },
    });

    invalidatePermissionCache();
    sendSuccess(res, { role, permKey, allowed: Boolean(allowed) }, 'Ruxsat yangilandi.');
  } catch (err) {
    console.error('setPermission error:', err);
    sendError(res, 'Ruxsatni o\'zgartirishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /permissions/my — Joriy foydalanuvchi ruxsatlari (hamma rollar)
// Frontend menyu/tugma gating uchun
// ══════════════════════════════════════════════
export const getMyPermissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.user!.role as string;
    const perms: Record<string, boolean> = {};
    for (const def of PERMISSIONS) {
      perms[def.key] = await hasPermission(role, def.key);
    }
    sendSuccess(res, { role, permissions: perms });
  } catch (err) {
    console.error('getMyPermissions error:', err);
    sendError(res, 'Ruxsatlarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// POST /permissions/founder — Founder foydalanuvchi yaratish (ADMIN)
// body: { fullName, phone, password }
// ══════════════════════════════════════════════
export const createFounder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { fullName, phone, password } = req.body;
    if (!fullName || !phone || !password) {
      sendError(res, 'Ism, telefon va parol kiritilishi shart.', 400);
      return;
    }
    if (String(password).length < 6) {
      sendError(res, 'Parol kamida 6 belgidan iborat bo\'lsin.', 400);
      return;
    }

    const normPhone = normalizePhone(String(phone));
    const exists = await prisma.user.findFirst({ where: { phone: normPhone } });
    if (exists) {
      sendError(res, 'Bu telefon raqam allaqachon ro\'yxatdan o\'tgan.', 400);
      return;
    }

    const passwordHash = await hashPassword(String(password));
    const user = await p.user.create({
      data: {
        fullName: String(fullName).trim(),
        phone: normPhone,
        passwordHash,
        role: 'FOUNDER',
        isActive: true,
      },
      select: { id: true, fullName: true, phone: true, role: true },
    });

    sendSuccess(res, user, `Founder yaratildi: ${user.fullName}`);
  } catch (err) {
    console.error('createFounder error:', err);
    sendError(res, 'Founder yaratishda xato.', 500);
  }
};
