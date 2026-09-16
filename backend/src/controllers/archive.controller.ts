/**
 * ARXIVLASH TIZIMI
 *
 * Admin istalgan davrni tanlab butun moliyaviy ma'lumotlarni arxivlaydi:
 *  - To'lovlar, xarajatlar, oylik hisoblar, maoshlar → arxivga belgilanadi
 *  - Barcha o'quvchi balans/qarzlari 0 ga tushiriladi
 *  - Aktiv hisob-kitoblar 0 dan boshlanadi
 *  - Arxivlangan ma'lumotlar "Arxiv" sahifasidan ko'riladi
 *
 * Eslatma: lib/prisma.ts dagi global middleware barcha aktiv so'rovlarda
 * archiveId = null filtrini avtomatik qo'shadi. Arxivni ko'rish uchun
 * so'rovda archiveId aniq beriladi.
 */
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';

const p = prisma as any;

const fmtNum = (v: unknown) => Math.round(Number(v || 0));

// ══════════════════════════════════════════════
// POST /archives — Davrni arxivlash
// body: { name: string, periodStart: 'YYYY-MM-DD', periodEnd: 'YYYY-MM-DD' }
// ══════════════════════════════════════════════
export const createArchive = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, periodStart, periodEnd } = req.body;
    if (!periodStart || !periodEnd) {
      sendError(res, 'Davr boshlanish va tugash sanalari kiritilishi shart.', 400);
      return;
    }
    const start = new Date(periodStart);
    const end = new Date(periodEnd + 'T23:59:59.999');
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      sendError(res, 'Sanalar noto\'g\'ri.', 400);
      return;
    }

    // ── 1. Davr bo'yicha yig'ilgan summalarni hisoblash (arxivlashdan OLDIN) ──
    const [paySum, expSum, feeSum, tSalSum, sSalSum, payCount, expCount, balances] = await Promise.all([
      p.payment.aggregate({ _sum: { amount: true }, where: { archiveId: null, isDeleted: false, paidAt: { gte: start, lte: end } } }),
      p.expense.aggregate({ _sum: { amount: true }, where: { archiveId: null, date: { gte: start, lte: end } } }),
      p.monthlyFee.aggregate({ _sum: { finalAmount: true }, where: { archiveId: null, month: { gte: start, lte: end } } }),
      p.teacherSalary.aggregate({ _sum: { paidSalary: true }, where: { archiveId: null, month: { gte: start, lte: end } } }),
      p.staffSalary.aggregate({ _sum: { amount: true }, where: { archiveId: null, month: { gte: start, lte: end } } }),
      p.payment.count({ where: { archiveId: null, isDeleted: false, paidAt: { gte: start, lte: end } } }),
      p.expense.count({ where: { archiveId: null, date: { gte: start, lte: end } } }),
      p.studentBalance.aggregate({ _sum: { balance: true, debt: true } }),
    ]);

    const summary = {
      totalIncome:    fmtNum(paySum._sum.amount),
      totalExpenses:  fmtNum(expSum._sum.amount),
      totalFees:      fmtNum(feeSum._sum.finalAmount),
      teacherSalaries: fmtNum(tSalSum._sum.paidSalary),
      staffSalaries:  fmtNum(sSalSum._sum.amount),
      paymentsCount:  payCount,
      expensesCount:  expCount,
      balancesAtClose: fmtNum(balances._sum.balance),
      debtsAtClose:    fmtNum(balances._sum.debt),
    };

    // ── 2. Tranzaksiya: arxiv yaratish + yozuvlarni belgilash + balanslarni 0 lash ──
    const archive = await prisma.$transaction(async (tx: any) => {
      const arch = await tx.archive.create({
        data: {
          name: name || `Arxiv ${periodStart} — ${periodEnd}`,
          periodStart: start,
          periodEnd: new Date(periodEnd),
          summary,
          createdBy: req.user?.id || null,
        },
      });

      await tx.payment.updateMany({
        where: { archiveId: null, paidAt: { gte: start, lte: end } },
        data: { archiveId: arch.id },
      });
      await tx.expense.updateMany({
        where: { archiveId: null, date: { gte: start, lte: end } },
        data: { archiveId: arch.id },
      });
      await tx.monthlyFee.updateMany({
        where: { archiveId: null, month: { gte: start, lte: end } },
        data: { archiveId: arch.id },
      });
      await tx.teacherSalary.updateMany({
        where: { archiveId: null, month: { gte: start, lte: end } },
        data: { archiveId: arch.id },
      });
      await tx.staffSalary.updateMany({
        where: { archiveId: null, month: { gte: start, lte: end } },
        data: { archiveId: arch.id },
      });

      // Barcha balans va qarzlarni 0 ga tushirish — yangi davr 0 dan boshlanadi
      await tx.studentBalance.updateMany({
        data: { balance: 0, debt: 0, lastUpdated: new Date() },
      });

      return arch;
    }, { timeout: 60_000 });

    // Audit
    try {
      if (req.user?.id) {
        await prisma.notification.create({
          data: {
            userId: req.user.id,
            title: 'Davr arxivlandi',
            body: `"${archive.name}": tushum ${summary.totalIncome.toLocaleString()} so'm, xarajat ${summary.totalExpenses.toLocaleString()} so'm arxivga o'tkazildi. Barcha balanslar 0 dan boshlandi.`,
            type: 'SYSTEM',
          },
        });
      }
    } catch { /* silent */ }

    sendSuccess(res, { archive, summary }, 'Davr muvaffaqiyatli arxivlandi! Hisob-kitoblar 0 dan boshlanadi.');
  } catch (err) {
    console.error('createArchive error:', err);
    sendError(res, 'Arxivlashda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /archives — Arxivlar ro'yxati
// ══════════════════════════════════════════════
export const getArchives = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const archives = await p.archive.findMany({ orderBy: { createdAt: 'desc' } });
    sendSuccess(res, archives);
  } catch (err) {
    console.error('getArchives error:', err);
    sendError(res, 'Arxivlarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /archives/:id — Arxiv tafsilotlari
// (arxivlangan to'lovlar va xarajatlar ro'yxati)
// ══════════════════════════════════════════════
export const getArchiveDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const archive = await p.archive.findUnique({ where: { id } });
    if (!archive) { sendError(res, 'Arxiv topilmadi.', 404); return; }

    const [payments, expenses] = await Promise.all([
      p.payment.findMany({
        where: { archiveId: id },
        include: { student: { include: { user: { select: { fullName: true } } } } },
        orderBy: { paidAt: 'desc' },
        take: 500,
      }),
      p.expense.findMany({
        where: { archiveId: id },
        orderBy: { date: 'desc' },
        take: 500,
      }),
    ]);

    sendSuccess(res, {
      archive,
      payments: payments.map((pm: any) => ({
        id: pm.id,
        studentName: pm.student?.user?.fullName || '—',
        amount: fmtNum(pm.amount),
        method: pm.paymentMethod,
        paidAt: pm.paidAt,
        isDeleted: pm.isDeleted,
      })),
      expenses: expenses.map((e: any) => ({
        id: e.id,
        category: e.category,
        amount: fmtNum(e.amount),
        date: e.date,
        description: e.description,
      })),
    });
  } catch (err) {
    console.error('getArchiveDetail error:', err);
    sendError(res, 'Arxiv tafsilotlarini olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// DELETE /archives/:id — Arxivni bekor qilish (yozuvlarni aktivga qaytarish)
// Balanslar qaytarilmaydi — faqat yozuvlar aktiv holatga qaytadi.
// ══════════════════════════════════════════════
export const restoreArchive = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const archive = await p.archive.findUnique({ where: { id } });
    if (!archive) { sendError(res, 'Arxiv topilmadi.', 404); return; }

    await prisma.$transaction(async (tx: any) => {
      await tx.payment.updateMany({ where: { archiveId: id }, data: { archiveId: null } });
      await tx.expense.updateMany({ where: { archiveId: id }, data: { archiveId: null } });
      await tx.monthlyFee.updateMany({ where: { archiveId: id }, data: { archiveId: null } });
      await tx.teacherSalary.updateMany({ where: { archiveId: id }, data: { archiveId: null } });
      await tx.staffSalary.updateMany({ where: { archiveId: id }, data: { archiveId: null } });
      await tx.archive.delete({ where: { id } });
    }, { timeout: 60_000 });

    sendSuccess(res, null, 'Arxiv bekor qilindi — yozuvlar aktiv hisobga qaytarildi. (Balanslar qo\'lda tekshirilsin!)');
  } catch (err) {
    console.error('restoreArchive error:', err);
    sendError(res, 'Arxivni bekor qilishda xato.', 500);
  }
};
