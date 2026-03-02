import prisma from '../lib/prisma';
import { Response } from 'express';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';


// ══════════════════════════════════════════════
// GET /coins/leaderboard — Top o'quvchilar
// ══════════════════════════════════════════════
export const getLeaderboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupId, limit = '20' } = req.query as Record<string, string>;

    const where: Record<string, unknown> = { user: { isActive: true } };
    if (groupId) {
      where.groupStudents = { some: { groupId: parseInt(groupId), status: 'ACTIVE' } };
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        user: { select: { fullName: true, avatarUrl: true } },
        groupStudents: {
          where: { status: 'ACTIVE' },
          include: { group: { select: { name: true, course: { select: { name: true } } } } }
        }
      },
      orderBy: { coinBalance: 'desc' },
      take: parseInt(limit)
    });

    sendSuccess(res, students.map((s, i) => ({
      rank: i + 1,
      id: s.id,
      fullName: s.user.fullName,
      avatarUrl: s.user.avatarUrl,
      coinBalance: s.coinBalance,
      groups: s.groupStudents.map(gs => gs.group.name),
    })));
  } catch (err) {
    console.error('getLeaderboard error:', err);
    sendError(res, 'Reytingni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// POST /coins/award — Coin berish
// ══════════════════════════════════════════════
export const awardCoins = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId, amount, reason, type = 'REWARD' } = req.body;

    if (!studentId || !amount || amount <= 0) {
      sendError(res, 'O\'quvchi va coin miqdori kiritilishi shart.', 400);
      return;
    }

    if (amount > 5 || amount < 0) {
      sendError(res, 'Coin miqdori 0 dan 5 gacha bo\'lishi kerak', 400);
      return;
    }

    const student = await prisma.student.findUnique({
      where: { id: parseInt(studentId) },
      include: { user: { select: { fullName: true } } }
    });

    if (!student) {
      sendError(res, 'O\'quvchi topilmadi.', 404);
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.coinTransaction.create({
        data: {
          studentId: parseInt(studentId),
          amount: parseInt(amount),
          type: type as 'REWARD' | 'PENALTY' | 'BONUS' | 'EXCHANGE',
          reason,
          givenBy: req.user!.id,
        }
      });

      const newBalance = await tx.student.update({
        where: { id: parseInt(studentId) },
        data: { coinBalance: { increment: parseInt(amount) } }
      });

      return { transaction, newBalance: newBalance.coinBalance };
    });

    sendSuccess(res, result, `${amount} ta coin berildi!`, 201);
  } catch (err) {
    console.error('awardCoins error:', err);
    sendError(res, 'Coin berishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// POST /coins/deduct — Coin olish (jarima)
// ══════════════════════════════════════════════
export const deductCoins = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId, amount, reason } = req.body;

    if (!studentId || !amount || amount <= 0) {
      sendError(res, 'O\'quvchi va coin miqdori kiritilishi shart.', 400);
      return;
    }

    if (amount > 5 || amount < 0) {
      sendError(res, 'Coin miqdori 0 dan 5 gacha bo\'lishi kerak', 400);
      return;
    }

    const student = await prisma.student.findUnique({ where: { id: parseInt(studentId) } });
    if (!student) { sendError(res, 'O\'quvchi topilmadi.', 404); return; }

    if (student.coinBalance < parseInt(amount)) {
      sendError(res, `O'quvchining coin balansi yetarli emas. Mavjud: ${student.coinBalance}`, 400);
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.coinTransaction.create({
        data: {
          studentId: parseInt(studentId),
          amount: -parseInt(amount),
          type: 'PENALTY',
          reason,
          givenBy: req.user!.id,
        }
      });

      return tx.student.update({
        where: { id: parseInt(studentId) },
        data: { coinBalance: { decrement: parseInt(amount) } }
      });
    });

    sendSuccess(res, { newBalance: result.coinBalance }, `${amount} ta coin olindi.`);
  } catch (err) {
    console.error('deductCoins error:', err);
    sendError(res, 'Coin olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /coins/history/:studentId — Coin tarixi
// ══════════════════════════════════════════════
export const getCoinHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.studentId);

    const transactions = await prisma.coinTransaction.findMany({
      where: { studentId },
      include: { giver: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { coinBalance: true }
    });

    sendSuccess(res, { transactions, currentBalance: student?.coinBalance || 0 });
  } catch (err) {
    console.error('getCoinHistory error:', err);
    sendError(res, 'Coin tarixini olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// POST /coins/auto-attendance — Davomat uchun avtomatik coin
// ══════════════════════════════════════════════
export const autoAwardAttendanceCoins = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { lessonId, coinPerPresent = 5, coinPerLate = 2 } = req.body;

    if (!lessonId) { sendError(res, 'Dars ID kiritilishi shart.', 400); return; }

    const attendances = await prisma.attendance.findMany({
      where: { lessonId: parseInt(lessonId), status: { in: ['PRESENT', 'LATE'] } },
      include: { student: true }
    });

    let awarded = 0;
    for (const att of attendances) {
      const coins = att.status === 'PRESENT' ? coinPerPresent : coinPerLate;
      if (coins > 0) {
        await prisma.$transaction([
          prisma.coinTransaction.create({
            data: {
              studentId: att.studentId,
              amount: coins,
              type: 'REWARD',
              reason: 'Darsga kelganlik uchun',
              givenBy: req.user!.id,
            }
          }),
          prisma.student.update({
            where: { id: att.studentId },
            data: { coinBalance: { increment: coins } }
          })
        ]);
        awarded++;
      }
    }

    sendSuccess(res, { awarded }, `${awarded} ta o'quvchiga davomat coini berildi.`);
  } catch (err) {
    console.error('autoAwardAttendanceCoins error:', err);
    sendError(res, 'Avtomatik coin berishda xato.', 500);
  }
};
