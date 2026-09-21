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
import { getFinanceTotals, getTotalIncome } from '../services/finance.service';

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

// ══════════════════════════════════════════════════════════════════
// GET /branches/:id/detail — Filial batafsil ko'rinishi
//   xonalar → guruhlar → o'quvchilar soni + filial moliyasi
// ══════════════════════════════════════════════════════════════════
export const getBranchDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = parseInt(req.params.id);
    const branch = await p.branch.findUnique({ where: { id: branchId } });
    if (!branch) { sendError(res, 'Filial topilmadi.', 404); return; }

    // Oy boshi/oxiri — joriy oy tushumi uchun
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Xonalar + har xonadagi guruhlar
    const rooms = await p.room.findMany({
      where: { branchId },
      orderBy: { name: 'asc' },
      include: {
        groups: {
          where: { status: 'ACTIVE' },
          include: {
            course:  { select: { name: true } },
            teacher: { include: { user: { select: { fullName: true } } } },
            _count:  { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
          },
        },
      },
    });

    // Xonaga biriktirilmagan guruhlar (filialdagi, room_id = null)
    const looseGroups = await p.group.findMany({
      where: { branchId, roomId: null, status: 'ACTIVE' },
      include: {
        course:  { select: { name: true } },
        teacher: { include: { user: { select: { fullName: true } } } },
        _count:  { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
      },
    });

    const mapGroup = (g: any) => ({
      id: g.id,
      name: g.name,
      courseName: g.course?.name ?? '—',
      teacherName: g.teacher?.user?.fullName ?? '—',
      studentsCount: g._count?.groupStudents ?? 0,
      roomId: g.roomId ?? null,
    });

    // Filial moliyasi (alohida)
    const [finance, monthIncome, studentsCount, groupsCount] = await Promise.all([
      getFinanceTotals(branchId),
      getTotalIncome(monthStart, monthEnd, branchId),
      p.student.count({ where: { branchId, status: 'ACTIVE' } }),
      p.group.count({ where: { branchId, status: 'ACTIVE' } }),
    ]);

    sendSuccess(res, {
      branch,
      rooms: rooms.map((r: any) => ({
        id: r.id,
        name: r.name,
        capacity: r.capacity,
        isActive: r.isActive,
        groups: r.groups.map(mapGroup),
        studentsCount: r.groups.reduce((s: number, g: any) => s + (g._count?.groupStudents ?? 0), 0),
      })),
      looseGroups: looseGroups.map(mapGroup),
      finance: {
        monthIncome,
        totalDebt:    finance.totalDebt,
        totalBalance: finance.totalBalance,
        debtorCount:  finance.debtorCount,
        studentsCount,
        groupsCount,
      },
    });
  } catch (err) {
    console.error('getBranchDetail error:', err);
    sendError(res, 'Filial ma\'lumotlarini olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════
// XONALAR CRUD
// ══════════════════════════════════════════════════════════════════

// POST /branches/:id/rooms — Yangi xona
export const createRoom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = parseInt(req.params.id);
    const { name, capacity } = req.body;
    if (!name || !String(name).trim()) { sendError(res, 'Xona nomi kiritilishi shart.', 400); return; }

    const branch = await p.branch.findUnique({ where: { id: branchId } });
    if (!branch) { sendError(res, 'Filial topilmadi.', 404); return; }

    const room = await p.room.create({
      data: {
        name: String(name).trim(),
        branchId,
        capacity: capacity ? parseInt(String(capacity)) : null,
      },
    });
    sendSuccess(res, room, 'Xona yaratildi!');
  } catch (err) {
    console.error('createRoom error:', err);
    sendError(res, 'Xona yaratishda xato.', 500);
  }
};

// PUT /rooms/:roomId — Xonani tahrirlash
export const updateRoom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const roomId = parseInt(req.params.roomId);
    const { name, capacity, isActive } = req.body;
    const room = await p.room.update({
      where: { id: roomId },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(capacity !== undefined && { capacity: capacity ? parseInt(String(capacity)) : null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });
    sendSuccess(res, room, 'Xona yangilandi!');
  } catch (err) {
    console.error('updateRoom error:', err);
    sendError(res, 'Xonani yangilashda xato.', 500);
  }
};

// DELETE /rooms/:roomId — Xonani o'chirish (guruhlar room_id = null bo'ladi)
export const deleteRoom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const roomId = parseInt(req.params.roomId);
    await p.group.updateMany({ where: { roomId }, data: { roomId: null } });
    await p.room.delete({ where: { id: roomId } });
    sendSuccess(res, null, 'Xona o\'chirildi.');
  } catch (err) {
    console.error('deleteRoom error:', err);
    sendError(res, 'Xonani o\'chirishda xato.', 500);
  }
};

// POST /rooms/:roomId/assign-groups — Guruhlarni xonaga biriktirish
export const assignGroupsToRoom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const roomId = parseInt(req.params.roomId);
    const { groupIds } = req.body as { groupIds?: number[] };
    if (!Array.isArray(groupIds) || !groupIds.length) {
      sendError(res, 'groupIds kiritilishi shart.', 400); return;
    }
    const room = await p.room.findUnique({ where: { id: roomId } });
    if (!room) { sendError(res, 'Xona topilmadi.', 404); return; }

    // Guruhni xonaga + filialga biriktirish
    const r = await p.group.updateMany({
      where: { id: { in: groupIds.map(Number) } },
      data: { roomId, branchId: room.branchId },
    });
    sendSuccess(res, { count: r.count }, `${r.count} guruh xonaga biriktirildi.`);
  } catch (err) {
    console.error('assignGroupsToRoom error:', err);
    sendError(res, 'Guruhlarni biriktirishda xato.', 500);
  }
};
