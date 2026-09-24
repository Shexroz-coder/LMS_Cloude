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

/**
 * Per-user ruxsat — filial mas'uli (ustoz) uchun qo'shimcha huquqlar.
 * Tartib: ADMIN → hammasi. Aks holda: per-user grant → rol → standart.
 */
export async function hasUserPermission(userId: number, role: string, permKey: string): Promise<boolean> {
  if (role === 'ADMIN') return true;
  try {
    const up = await (prisma as any).userPermission.findUnique({
      where: { userId_permKey: { userId, permKey } },
    });
    if (up) return up.allowed;
  } catch { /* jadval yo'q bo'lsa — rolga tushamiz */ }
  return hasPermission(role, permKey);
}

export const requirePerm = (permKey: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      sendError(res, 'Autentifikatsiya talab qilinadi.', 401);
      return;
    }
    const allowed = await hasUserPermission(req.user.id, req.user.role, permKey);
    if (!allowed) {
      sendError(res, "Bu funksiya siz uchun o'chirilgan. Admin bilan bog'laning.", 403);
      return;
    }
    next();
  };
};

/**
 * ADMIN yoki filial mas'uliga ruxsat.
 *  - ADMIN → hamma narsa, filial cheklovi yo'q.
 *  - Filial mas'uli (managedBranchId bor) → shu permKey ruxsati bo'lsa,
 *    so'rov AVTOMATIK o'z filialiga cheklanadi (branchId majburiy o'rnatiladi).
 */
export const adminOrManager = (permKey: string, opts?: { allowFounder?: boolean }) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { sendError(res, 'Autentifikatsiya talab qilinadi.', 401); return; }
    if (req.user.role === 'ADMIN') { next(); return; }
    // FOUNDER — faqat o'qish uchun ruxsat berilgan GET routelar (branch cheklovsiz,
    // o'z branch tanlagichiga bo'ysunadi, xuddi ADMIN kabi)
    if (opts?.allowFounder && (req.user.role as string) === 'FOUNDER') { next(); return; }

    // Filial mas'ulimi?
    let managedBranchId: number | null = null;
    try {
      const u = await (prisma as any).user.findUnique({
        where: { id: req.user.id }, select: { managedBranchId: true },
      });
      managedBranchId = u?.managedBranchId ?? null;
    } catch { /* ignore */ }

    if (!managedBranchId) {
      sendError(res, 'Ruxsat yo\'q. Siz filial mas\'uli emassiz.', 403);
      return;
    }

    // Filial mas'uli — o'z filiali doirasida BARCHA filial-admin funksiyalariga
    // DEFAULT ruxsatga ega. Faqat super admin aniq "o'chirib qo'ygan" (UserPermission
    // allowed=false) bo'lsagina taqiqlanadi.
    let denied = false;
    try {
      const up = await (prisma as any).userPermission.findUnique({
        where: { userId_permKey: { userId: req.user.id, permKey } },
      });
      if (up && up.allowed === false) denied = true;
    } catch { /* jadval yo'q bo'lsa — ruxsat beriladi */ }
    if (denied) {
      sendError(res, "Bu funksiya siz uchun o'chirilgan.", 403);
      return;
    }

    // So'rovni o'z filialiga majburan cheklash (boshqa filialni ko'ra olmaydi)
    (req.query as any).branchId = String(managedBranchId);
    if (req.body && typeof req.body === 'object') (req.body as any).branchId = managedBranchId;
    req.managedBranchId = managedBranchId;
    next();
  };
};
