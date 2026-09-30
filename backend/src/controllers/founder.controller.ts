import { Response } from 'express';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/response.utils';
import { AuthRequest } from '../types';

// Sana oralig'ini o'qish (default: joriy oy)
function readRange(req: AuthRequest): { from: Date; to: Date } {
  const q = req.query as Record<string, string>;
  const now = new Date();
  const from = q.from ? new Date(q.from) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = q.to ? new Date(q.to) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { from, to };
}

// ══════════════════════════════════════════════
// GET /founder/overview — Founder uchun asosiy ko'rsatkichlar
//  - umumiy: o'quvchilar, guruhlar, o'qituvchilar, filiallar soni
//  - o'qituvchilar: guruh soni, o'tilgan soat (jami) + oraliqdagi soat
// ══════════════════════════════════════════════
export const getFounderOverview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { from, to } = readRange(req);

    const [studentsCount, groupsCount, teachersCount, branchesCount] = await Promise.all([
      prisma.student.count({ where: { status: 'ACTIVE', user: { isActive: true } } }),
      prisma.group.count({ where: { status: 'ACTIVE' } }),
      prisma.teacher.count(),
      (prisma as any).branch.count(),
    ]);

    // Faol guruhlar bo'yicha o'qituvchi → guruh soni
    const activeGroups = await prisma.group.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, teacherId: true },
    });
    const groupsByTeacher = new Map<number, number>();
    for (const g of activeGroups) {
      if (g.teacherId != null) groupsByTeacher.set(g.teacherId, (groupsByTeacher.get(g.teacherId) || 0) + 1);
    }

    // O'tilgan darslar (COMPLETED) — soatlar. group.teacherId orqali o'qituvchiga bog'lanadi.
    const completed = await prisma.lesson.findMany({
      where: { status: 'COMPLETED' },
      select: { durationHours: true, date: true, group: { select: { teacherId: true } } },
    });
    const totalHoursByTeacher = new Map<number, number>();
    const monthHoursByTeacher = new Map<number, number>();
    for (const l of completed) {
      const tid = l.group?.teacherId;
      if (tid == null) continue;
      const h = Number(l.durationHours || 0);
      totalHoursByTeacher.set(tid, (totalHoursByTeacher.get(tid) || 0) + h);
      if (l.date >= from && l.date <= to) {
        monthHoursByTeacher.set(tid, (monthHoursByTeacher.get(tid) || 0) + h);
      }
    }

    // O'qituvchilar ro'yxati
    const teachers = await prisma.teacher.findMany({
      select: { id: true, user: { select: { fullName: true } } },
    });
    const teacherRows = teachers.map(t => ({
      id: t.id,
      name: t.user?.fullName || '—',
      groupsCount: groupsByTeacher.get(t.id) || 0,
      totalHours: Math.round((totalHoursByTeacher.get(t.id) || 0) * 10) / 10,
      monthHours: Math.round((monthHoursByTeacher.get(t.id) || 0) * 10) / 10,
    })).sort((a, b) => b.monthHours - a.monthHours);

    const monthHoursTotal = teacherRows.reduce((s, t) => s + t.monthHours, 0);
    const totalHoursAll = teacherRows.reduce((s, t) => s + t.totalHours, 0);

    sendSuccess(res, {
      totals: { studentsCount, groupsCount, teachersCount, branchesCount },
      range: { from, to },
      hours: { month: Math.round(monthHoursTotal * 10) / 10, allTime: Math.round(totalHoursAll * 10) / 10 },
      teachers: teacherRows,
    });
  } catch (err) {
    console.error('getFounderOverview error:', err);
    sendError(res, "Ko'rsatkichlarni olishda xato.", 500);
  }
};

// ══════════════════════════════════════════════
// GET /founder/groups — barcha filiallar bo'yicha guruhlar + o'quvchilar
//  ?branchId=N — bitta filialга cheklash (drill-down)
// ══════════════════════════════════════════════
export const getFounderGroups = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = req.query as Record<string, string>;
    const bId = q.branchId && q.branchId !== 'all' ? parseInt(q.branchId) : NaN;

    const where: any = { status: 'ACTIVE' };
    if (Number.isFinite(bId) && bId > 0) where.branchId = bId;

    const groups = await prisma.group.findMany({
      where,
      select: {
        id: true, name: true,
        branch: { select: { id: true, name: true } },
        course: { select: { name: true } },
        teacher: { select: { user: { select: { fullName: true } } } },
        groupStudents: {
          where: { status: 'ACTIVE' },
          select: {
            student: {
              select: {
                id: true,
                user: { select: { fullName: true, phone: true } },
                balance: { select: { debt: true } },
              },
            },
          },
        },
      },
      orderBy: [{ branchId: 'asc' }, { name: 'asc' }],
    } as any);

    const result = groups.map((g: any) => ({
      id: g.id,
      name: g.name,
      branch: g.branch?.name || 'Filialsiz',
      branchId: g.branch?.id || null,
      course: g.course?.name || '—',
      teacher: g.teacher?.user?.fullName || '—',
      studentsCount: g.groupStudents.length,
      students: g.groupStudents.map((gs: any) => ({
        id: gs.student.id,
        name: gs.student.user.fullName,
        phone: gs.student.user.phone,
        debt: Number(gs.student.balance?.debt || 0),
      })),
    }));

    sendSuccess(res, result);
  } catch (err) {
    console.error('getFounderGroups error:', err);
    sendError(res, 'Guruhlarni olishda xato.', 500);
  }
};
