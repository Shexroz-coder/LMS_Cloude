/**
 * FILIALLAR BOSHQARUVI
 *
 * Filial CRUD + har filial bo'yicha qisqa statistika.
 * O'quvchi, guruh, to'lov, xarajatlar filialga bog'lanadi.
 */
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';

const p = prisma as any;

// ══════════════════════════════════════════════
// GET /branches — Barcha filiallar (statistika bilan)
// ══════════════════════════════════════════════
export const getBranches = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branches = await p.branch.findMany({
      orderBy: { id: 'asc' },
    }) as Array<{ id: number; name: string; address: string | null; phone: string | null; isActive: boolean; createdAt: Date }>;

    // Har filial uchun sanoqlar
    const result = await Promise.all(branches.map(async (b) => {
      const [studentsCount, groupsCount] = await Promise.all([
        p.student.count({ where: { branchId: b.id, status: 'ACTIVE' } }),
        p.group.count({ where: { branchId: b.id, status: 'ACTIVE' } }),
      ]);
      return { ...b, studentsCount, groupsCount };
    }));

    sendSuccess(res, result);
  } catch (err) {
    console.error('getBranches error:', err);
    sendError(res, 'Filiallarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// POST /branches — Yangi filial
// ══════════════════════════════════════════════
export const createBranch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, address, phone } = req.body;
    if (!name || !String(name).trim()) {
      sendError(res, 'Filial nomi kiritilishi shart.', 400);
      return;
    }
    const branch = await p.branch.create({
      data: { name: String(name).trim(), address: address || null, phone: phone || null },
    });
    sendSuccess(res, branch, 'Filial yaratildi!');
  } catch (err) {
    console.error('createBranch error:', err);
    sendError(res, 'Filial yaratishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// PUT /branches/:id — Filialni tahrirlash
// ══════════════════════════════════════════════
export const updateBranch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { name, address, phone, isActive } = req.body;
    const branch = await p.branch.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });
    sendSuccess(res, branch, 'Filial yangilandi!');
  } catch (err) {
    console.error('updateBranch error:', err);
    sendError(res, 'Filialni yangilashda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// POST /branches/:id/assign — O'quvchi/guruhlarni filialga o'tkazish
// body: { studentIds?: number[], groupIds?: number[] }
// ══════════════════════════════════════════════
export const assignToBranch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = parseInt(req.params.id);
    const { studentIds, groupIds } = req.body as { studentIds?: number[]; groupIds?: number[] };

    const branch = await p.branch.findUnique({ where: { id: branchId } });
    if (!branch) { sendError(res, 'Filial topilmadi.', 404); return; }

    let students = 0, groups = 0;
    if (Array.isArray(studentIds) && studentIds.length) {
      const r = await p.student.updateMany({
        where: { id: { in: studentIds.map(Number) } },
        data: { branchId },
      });
      students = r.count;
    }
    if (Array.isArray(groupIds) && groupIds.length) {
      const r = await p.group.updateMany({
        where: { id: { in: groupIds.map(Number) } },
        data: { branchId },
      });
      groups = r.count;
    }

    sendSuccess(res, { students, groups }, `${students} o'quvchi, ${groups} guruh "${branch.name}" filialiga o'tkazildi.`);
  } catch (err) {
    console.error('assignToBranch error:', err);
    sendError(res, 'Filialga o\'tkazishda xato.', 500);
  }
};
