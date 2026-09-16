import { AuthRequest } from '../types';

/**
 * So'rovdan filial ID sini olish (?branchId=N).
 * Frontend axios interceptor tanlangan filialni har GET so'rovga qo'shadi.
 * Qiymat bo'lmasa yoki noto'g'ri bo'lsa → undefined (barcha filiallar).
 */
export function getBranchId(req: AuthRequest): number | undefined {
  const raw = (req.query?.branchId ?? (req.body as any)?.branchId) as string | number | undefined;
  if (raw === undefined || raw === null || raw === '' || raw === 'all') return undefined;
  const n = parseInt(String(raw));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
