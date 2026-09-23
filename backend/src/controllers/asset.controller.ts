/**
 * INVENTAR / JIHOZLAR — har filial bo'yicha alohida.
 * Robototexnika to'plamlari, kompyuterlar, mebel, asboblar va h.k.
 */
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';
import { getBranchId } from '../utils/branch.utils';

const p = prisma as any;
const num = (v: unknown) => Math.round(Number(v || 0));

// ══════════════════════════════════════════════
// GET /assets — Jihozlar (filial bo'yicha) + xulosa
// ══════════════════════════════════════════════
export const getAssets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = getBranchId(req);
    const { category } = req.query as Record<string, string>;
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (category) where.category = category;

    const assets = await p.asset.findMany({
      where,
      include: { branch: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Xulosa: umumiy soni, umumiy qiymati, kategoriya bo'yicha
    let totalItems = 0, totalValue = 0;
    const byCategory: Record<string, { count: number; value: number }> = {};
    for (const a of assets) {
      const qty = a.quantity || 0;
      const val = qty * num(a.unitValue);
      totalItems += qty;
      totalValue += val;
      const c = a.category;
      if (!byCategory[c]) byCategory[c] = { count: 0, value: 0 };
      byCategory[c].count += qty;
      byCategory[c].value += val;
    }

    sendSuccess(res, {
      assets: assets.map((a: any) => ({
        id: a.id, name: a.name, category: a.category, quantity: a.quantity,
        condition: a.condition, unitValue: num(a.unitValue),
        totalValue: a.quantity * num(a.unitValue),
        note: a.note, branchId: a.branchId, branchName: a.branch?.name,
      })),
      summary: { totalItems, totalValue, byCategory },
    });
  } catch (err) {
    console.error('getAssets error:', err);
    sendError(res, 'Jihozlarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// POST /assets — Yangi jihoz
// ══════════════════════════════════════════════
export const createAsset = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, category = 'OTHER', quantity = 1, condition = 'GOOD', unitValue, note, branchId } = req.body;
    if (!name || !String(name).trim()) { sendError(res, 'Jihoz nomi kiritilishi shart.', 400); return; }
    if (!branchId) { sendError(res, 'Filial tanlanishi shart.', 400); return; }

    const asset = await p.asset.create({
      data: {
        name: String(name).trim(),
        category, quantity: parseInt(String(quantity)) || 1,
        condition,
        unitValue: unitValue ? parseFloat(String(unitValue)) : null,
        note: note || null,
        branchId: parseInt(String(branchId)),
      },
    });
    sendSuccess(res, asset, 'Jihoz qo\'shildi!', 201);
  } catch (err) {
    console.error('createAsset error:', err);
    sendError(res, 'Jihoz qo\'shishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// PUT /assets/:id — Tahrirlash
// ══════════════════════════════════════════════
export const updateAsset = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { name, category, quantity, condition, unitValue, note, branchId } = req.body;
    const asset = await p.asset.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(category !== undefined && { category }),
        ...(quantity !== undefined && { quantity: parseInt(String(quantity)) || 1 }),
        ...(condition !== undefined && { condition }),
        ...(unitValue !== undefined && { unitValue: unitValue ? parseFloat(String(unitValue)) : null }),
        ...(note !== undefined && { note }),
        ...(branchId !== undefined && { branchId: parseInt(String(branchId)) }),
      },
    });
    sendSuccess(res, asset, 'Jihoz yangilandi!');
  } catch (err) {
    console.error('updateAsset error:', err);
    sendError(res, 'Jihozni yangilashda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// DELETE /assets/:id
// ══════════════════════════════════════════════
export const deleteAsset = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await p.asset.delete({ where: { id } });
    sendSuccess(res, null, 'Jihoz o\'chirildi.');
  } catch (err) {
    console.error('deleteAsset error:', err);
    sendError(res, 'Jihozni o\'chirishda xato.', 500);
  }
};
