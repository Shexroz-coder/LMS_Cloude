/**
 * RUXSAT TEKSHIRISH MIDDLEWARE
 *
 * requirePerm('attendance.mark') — so'rovni faqat shu funksiyaga
 * ruxsati bor foydalanuvchi bajarishi mumkin.
 *
 * Tartib: ADMIN → har doim ruxsat.
 * Boshqa rollar: DB'dagi RolePermission yozuvi → bo'lmasa standart (config).
 * DB natijasi 30 soniya keshlanadi (har so'rovda query bo'lmasligi uchun).
 */
import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { sendError } from '../utils/response.utils';
import { AuthRequest } from '../types';
import { getDefaultPermission } from '../config/permissions';

// ── Kesh: "ROLE:permKey" → allowed ──
let cache: Map<string, boolean> = new Map();
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 30_000;

async function loadOverrides(): Promise<Map<string, boolean>> {
  const now = Date.now();
  if (now - cacheLoadedAt < CACHE_TTL_MS) return cache;
  try {
    const rows = await (prisma as any).rolePermission.findMany() as Array<{
      role: string; permKey: string; allowed: boolean;
    }>;
    cache = new Map(rows.map(r => [`${r.role}:${r.permKey}`, r.allowed]));
    cacheLoadedAt = now;
  } catch {
    // Jadval hali migratsiya qilinmagan bo'lsa — standartlar ishlaydi
    cache = new Map();
    cacheLoadedAt = now;
  }
  return cache;
}

/** Keshni darhol tozalash (admin ruxsat o'zgartirganda) */
export function invalidatePermissionCache(): void {
  cacheLoadedAt = 0;
}

/** Foydalanuvchi rolining amaldagi ruxsatini hisoblash */
export async function hasPermission(role: string, permKey: string): Promise<boolean> {
  if (role === 'ADMIN') return true;
  const overrides = await loadOverrides();
  const override = overrides.get(`${role}:${permKey}`);
  if (override !== undefined) return override;
  return getDefaultPermission(role, permKey);
}

export const requirePerm = (permKey: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      sendError(res, 'Autentifikatsiya talab qilinadi.', 401);
      return;
    }
    const allowed = await hasPermission(req.user.role, permKey);
    if (!allowed) {
      sendError(res, "Bu funksiya siz uchun o'chirilgan. Admin bilan bog'laning.", 403);
      return;
    }
    next();
  };
};
