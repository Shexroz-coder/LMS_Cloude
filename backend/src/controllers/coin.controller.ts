import prisma from '../lib/prisma';
import { Response } from 'express';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';
import bot from '../telegram/bot';
import { escapeHtml } from '../telegram/utils/format';


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

    const coinAmount = parseInt(String(amount));
    if (!studentId || !amount || isNaN(coinAmount) || coinAmount <= 0) {
      sendError(res, 'O\'quvchi va coin miqdori kiritilishi shart.', 400);
      return;
    }

    if (coinAmount > 5) {
      sendError(res, 'Coin miqdori 1 dan 5 gacha bo\'lishi kerak', 400);
      return;
    }

    const student = await prisma.student.findUnique({
      where: { id: parseInt(studentId) },
      include: { user: { select: { id: true, fullName: true, telegramChatId: true } } }
    });

    if (!student) {
      sendError(res, 'O\'quvchi topilmadi.', 404);
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.coinTransaction.create({
        data: {
          studentId: parseInt(studentId),
          amount: coinAmount,
          type: type as 'REWARD' | 'PENALTY' | 'BONUS' | 'EXCHANGE',
          reason,
          givenBy: req.user!.id,
        }
      });

      const newBalance = await tx.student.update({
        where: { id: parseInt(studentId) },
        data: { coinBalance: { increment: coinAmount } }
      });

      return { transaction, newBalance: newBalance.coinBalance };
    });

    // O'quvchiga LMS Notification yuborish
    try {
      const reasonText = reason ? ` (${reason})` : '';
      await prisma.notification.create({
        data: {
          userId: student.user.id,
          title: '🎉 Tabriklaymiz!',
          body: `Sizga ${coinAmount} ta coin taqdim etildi!${reasonText}`,
          type: 'COIN'
        }
      });
    } catch (e) {
      console.error('❌ O\'quvchi notification xatosi:', e);
    }

    // Ota-onaga xabari yuborish (agar mavjud bo'lsa)
    try {
      const parent = await prisma.user.findFirst({
        where: {
          role: 'PARENT',
          parentStudents: { some: { id: parseInt(studentId) } }
        },
        select: { id: true, fullName: true, telegramChatId: true }
      });

      if (parent) {
        const reasonText = reason ? ` (${reason})` : '';
        await prisma.notification.create({
          data: {
            userId: parent.id,
            title: '🎯 Farzandingiz mukofot oldi',
            body: `${student.user.fullName} ${coinAmount} ta coin oldi!${reasonText}`,
            type: 'COIN'
          }
        });

        // Ota-onaga Telegram xabari
        if (parent.telegramChatId) {
          try {
            const msg = `🎉 <b>Farzandingiz mukofot oldi!</b>\n\n` +
              `👤 <b>${escapeHtml(student.user.fullName)}</b>\n` +
              `🎁 Coin: <b>${coinAmount} ta</b>\n` +
              `📝 Sabab: ${reason ? escapeHtml(reason) : 'Yaxshi ishlash'}\n\n` +
              `Jami balans: <b>${result.newBalance} coin</b>`;

            await bot.api.sendMessage(parent.telegramChatId, msg, { parse_mode: 'HTML' });
          } catch (e) {
            console.error('❌ Ota-onaga Telegram xabari yuborishda xato:', e);
          }
        }
      }
    } catch (e) {
      console.error('❌ Ota-ona notification xatosi:', e);
    }

    // O'quvchiga Telegram xabari
    if (student.user.telegramChatId) {
      try {
        const msg = `🎉 <b>Tabriklaymiz!</b>\n\n` +
          `Sizga <b>${coinAmount} ta coin</b> taqdim etildi!\n` +
          `📝 Sabab: ${reason ? escapeHtml(reason) : 'Yaxshi ishlash'}\n\n` +
          `Jami balans: <b>${result.newBalance} coin</b>`;

        await bot.api.sendMessage(student.user.telegramChatId, msg, { parse_mode: 'HTML' });
      } catch (e) {
        console.error('❌ O\'quvchiga Telegram xabari yuborishda xato:', e);
      }
    }

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

    const deductAmount = parseInt(String(amount));
    if (!studentId || !amount || isNaN(deductAmount) || deductAmount <= 0) {
      sendError(res, 'O\'quvchi va coin miqdori kiritilishi shart.', 400);
      return;
    }

    if (deductAmount > 5) {
      sendError(res, 'Coin miqdori 1 dan 5 gacha bo\'lishi kerak', 400);
      return;
    }

    const student = await prisma.student.findUnique({
      where: { id: parseInt(studentId) },
      include: { user: { select: { fullName: true, id: true, telegramChatId: true } } }
    });
    if (!student) { sendError(res, 'O\'quvchi topilmadi.', 404); return; }

    if (student.coinBalance < deductAmount) {
      sendError(res, `O'quvchining coin balansi yetarli emas. Mavjud: ${student.coinBalance}`, 400);
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.coinTransaction.create({
        data: {
          studentId: parseInt(studentId),
          amount: -deductAmount,
          type: 'PENALTY',
          reason,
          givenBy: req.user!.id,
        }
      });

      return tx.student.update({
        where: { id: parseInt(studentId) },
        data: { coinBalance: { decrement: deductAmount } }
      });
    });

    // O'quvchiga LMS Notification yuborish
    try {
      const reasonText = reason ? ` (${reason})` : '';
      await prisma.notification.create({
        data: {
          userId: student.user.id,
          title: '⚠️ Coin olindi',
          body: `Sizdan ${deductAmount} ta coin olindi!${reasonText}`,
          type: 'COIN'
        }
      });
    } catch (e) {
      console.error('❌ O\'quvchi notification xatosi:', e);
    }

    // Ota-onaga xabari yuborish (agar mavjud bo'lsa)
    try {
      const parent = await prisma.user.findFirst({
        where: {
          role: 'PARENT',
          parentStudents: { some: { id: parseInt(studentId) } }
        },
        select: { id: true, fullName: true, telegramChatId: true }
      });

      if (parent) {
        const reasonText = reason ? ` (${reason})` : '';
        await prisma.notification.create({
          data: {
            userId: parent.id,
            title: '⚠️ Farzandingizdan coin olindi',
            body: `${student.user.fullName} dan ${deductAmount} ta coin olindi!${reasonText}`,
            type: 'COIN'
          }
        });

        // Ota-onaga Telegram xabari
        if (parent.telegramChatId) {
          try {
            const msg = `⚠️ <b>Farzandingizdan coin olindi</b>\n\n` +
              `👤 <b>${escapeHtml(student.user.fullName)}</b>\n` +
              `❌ Coin: <b>${deductAmount} ta</b>\n` +
              `📝 Sabab: ${reason ? escapeHtml(reason) : 'Qoidalarga murosaat'}\n\n` +
              `Jami balans: <b>${result.coinBalance} coin</b>`;

            await bot.api.sendMessage(parent.telegramChatId, msg, { parse_mode: 'HTML' });
          } catch (e) {
            console.error('❌ Ota-onaga Telegram xabari yuborishda xato:', e);
          }
        }
      }
    } catch (e) {
      console.error('❌ Ota-ona notification xatosi:', e);
    }

    // O'quvchiga Telegram xabari
    if (student.user.telegramChatId) {
      try {
        const msg = `⚠️ <b>Coin olindi</b>\n\n` +
          `Sizdan <b>${deductAmount} ta coin</b> olindi!\n` +
          `📝 Sabab: ${reason ? escapeHtml(reason) : 'Qoidalarga murosaat'}\n\n` +
          `Jami balans: <b>${result.coinBalance} coin</b>`;

        await bot.api.sendMessage(student.user.telegramChatId, msg, { parse_mode: 'HTML' });
      } catch (e) {
        console.error('❌ O\'quvchiga Telegram xabari yuborishda xato:', e);
      }
    }

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

// ══════════════════════════════════════════════
// POST /coins/award-bulk — Bir vaqtda bir nechta o'quvchiga coin berish
// ══════════════════════════════════════════════
export const awardBulkCoins = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // awards: [{studentId, amount, reason?}]
    const { awards } = req.body as { awards: Array<{ studentId: number; amount: number; reason?: string }> };

    if (!Array.isArray(awards) || awards.length === 0) {
      sendError(res, 'Coin ro\'yxati bo\'sh.', 400);
      return;
    }

    const valid = awards.filter(a => a.studentId && a.amount > 0);
    if (valid.length === 0) {
      sendSuccess(res, { awarded: 0 }, '0 ta coin berildi.');
      return;
    }

    // Tranzaksiya: barcha coinlarni bir vaqtda berish
    await prisma.$transaction(
      valid.flatMap(a => [
        prisma.coinTransaction.create({
          data: {
            studentId: a.studentId,
            amount: a.amount,
            type: 'REWARD',
            reason: a.reason || 'Davomat uchun',
            givenBy: req.user!.id,
          }
        }),
        prisma.student.update({
          where: { id: a.studentId },
          data: { coinBalance: { increment: a.amount } }
        })
      ])
    );

    sendSuccess(res, { awarded: valid.length }, `${valid.length} ta o'quvchiga coin berildi.`);
  } catch (err) {
    console.error('awardBulkCoins error:', err);
    sendError(res, 'Coin berishda xato.', 500);
  }
};
