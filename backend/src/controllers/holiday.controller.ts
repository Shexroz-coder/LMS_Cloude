import prisma from '../lib/prisma';
import { Response } from 'express';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';


// ══════════════════════════════════════════════
// GET /holidays — Barcha bayram/dam olish kunlari
// ══════════════════════════════════════════════
export const getHolidays = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { year, type } = req.query as { year?: string; type?: string };

    const where: Record<string, unknown> = {};

    if (year) {
      const y = parseInt(year);
      const startOfYear = new Date(y, 0, 1);
      const endOfYear = new Date(y, 11, 31);
      where.OR = [
        { date: { gte: startOfYear, lte: endOfYear } },
        { isRecurring: true },
      ];
    }

    if (type) {
      where.type = type;
    }

    const holidays = await prisma.holiday.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    sendSuccess(res, holidays);
  } catch (err) {
    console.error('getHolidays error:', err);
    sendError(res, 'Bayramlar ro\'yxatini olishda xato.', 500);
  }
};


// ══════════════════════════════════════════════
// POST /holidays — Yangi bayram/dam olish kuni qo'shish
// ══════════════════════════════════════════════
export const createHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, date, endDate, isRecurring, type } = req.body;

    if (!name || !date) {
      sendError(res, 'Nom va sana kiritilishi shart.', 400);
      return;
    }

    const holiday = await prisma.holiday.create({
      data: {
        name,
        date: new Date(date),
        endDate: endDate ? new Date(endDate) : null,
        isRecurring: isRecurring || false,
        type: type || 'HOLIDAY',
        createdBy: req.user?.id || null,
      },
    });

    sendSuccess(res, holiday, 'Bayram muvaffaqiyatli qo\'shildi!', 201);
  } catch (err) {
    console.error('createHoliday error:', err);
    sendError(res, 'Bayram qo\'shishda xato.', 500);
  }
};


// ══════════════════════════════════════════════
// PUT /holidays/:id — Bayramni tahrirlash
// ══════════════════════════════════════════════
export const updateHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { name, date, endDate, isRecurring, type } = req.body;

    const existing = await prisma.holiday.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, 'Bayram topilmadi.', 404);
      return;
    }

    const holiday = await prisma.holiday.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(isRecurring !== undefined && { isRecurring }),
        ...(type !== undefined && { type }),
      },
    });

    sendSuccess(res, holiday, 'Bayram yangilandi!');
  } catch (err) {
    console.error('updateHoliday error:', err);
    sendError(res, 'Bayramni yangilashda xato.', 500);
  }
};


// ══════════════════════════════════════════════
// DELETE /holidays/:id — Bayramni o'chirish
// ══════════════════════════════════════════════
export const deleteHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    const existing = await prisma.holiday.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, 'Bayram topilmadi.', 404);
      return;
    }

    await prisma.holiday.delete({ where: { id } });

    sendSuccess(res, null, 'Bayram o\'chirildi!');
  } catch (err) {
    console.error('deleteHoliday error:', err);
    sendError(res, 'Bayramni o\'chirishda xato.', 500);
  }
};


// ══════════════════════════════════════════════
// GET /holidays/dates?from=&to= — Berilgan oraliqda bayram sanalari
// ══════════════════════════════════════════════
export const getHolidayDatesInRange = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };

    if (!from || !to) {
      sendError(res, 'from va to parametrlari kiritilishi shart.', 400);
      return;
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    // schedule.utils dan import qilish o'rniga inline hisoblash (bu endpoint uchun)
    const holidays = await prisma.holiday.findMany({
      where: {
        OR: [
          { date: { gte: fromDate, lte: toDate } },
          { date: { lte: toDate }, endDate: { gte: fromDate } },
          { isRecurring: true },
        ],
      },
    });

    const dates: string[] = [];
    const fromYear = fromDate.getFullYear();
    const toYear = toDate.getFullYear();

    for (const h of holidays) {
      if (h.isRecurring) {
        const hMonth = h.date.getMonth();
        const hDay = h.date.getDate();
        const hEndMonth = h.endDate ? h.endDate.getMonth() : hMonth;
        const hEndDay = h.endDate ? h.endDate.getDate() : hDay;

        for (let year = fromYear; year <= toYear; year++) {
          const start = new Date(year, hMonth, hDay);
          const end = new Date(year, hEndMonth, hEndDay);
          const cursor = new Date(start);
          while (cursor <= end) {
            if (cursor >= fromDate && cursor <= toDate) {
              dates.push(formatDateKey(cursor));
            }
            cursor.setDate(cursor.getDate() + 1);
          }
        }
      } else {
        const start = new Date(h.date);
        const end = h.endDate ? new Date(h.endDate) : new Date(h.date);
        const cursor = new Date(start);
        while (cursor <= end) {
          if (cursor >= fromDate && cursor <= toDate) {
            dates.push(formatDateKey(cursor));
          }
          cursor.setDate(cursor.getDate() + 1);
        }
      }
    }

    sendSuccess(res, { dates: [...new Set(dates)].sort() });
  } catch (err) {
    console.error('getHolidayDatesInRange error:', err);
    sendError(res, 'Bayram sanalarini olishda xato.', 500);
  }
};


function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
