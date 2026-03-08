import prisma from '../lib/prisma';

/**
 * Berilgan sana oraliqda barcha bayram/dam olish kunlarining Date[] ro'yxatini qaytaradi.
 * endDate mavjud bo'lsa, oraliqni kengaytiradi (masalan: 5-mart – 10-mart).
 * isRecurring=true bo'lsa, faqat oy-kun bo'yicha solishtiriladi.
 */
export async function getHolidayDatesInRange(from: Date, to: Date): Promise<Set<string>> {
  const holidays = await prisma.holiday.findMany({
    where: {
      OR: [
        // Aniq sana oraliqda
        { date: { gte: from, lte: to } },
        // endDate bilan overlap
        { date: { lte: to }, endDate: { gte: from } },
        // Har yili takrorlanuvchi
        { isRecurring: true },
      ],
    },
  });

  const result = new Set<string>();
  const fromYear = from.getFullYear();
  const toYear = to.getFullYear();

  for (const h of holidays) {
    if (h.isRecurring) {
      // Har yili takrorlanuvchi — faqat oy va kunni tekshirish
      const hMonth = h.date.getMonth();
      const hDay = h.date.getDate();
      const hEndMonth = h.endDate ? h.endDate.getMonth() : hMonth;
      const hEndDay = h.endDate ? h.endDate.getDate() : hDay;

      for (let year = fromYear; year <= toYear; year++) {
        const start = new Date(year, hMonth, hDay);
        const end = new Date(year, hEndMonth, hEndDay);
        // Sanma-sana qo'shish
        const cursor = new Date(start);
        while (cursor <= end) {
          if (cursor >= from && cursor <= to) {
            result.add(formatDateKey(cursor));
          }
          cursor.setDate(cursor.getDate() + 1);
        }
      }
    } else {
      // Oddiy bayram — date dan endDate gacha
      const start = new Date(h.date);
      const end = h.endDate ? new Date(h.endDate) : new Date(h.date);
      const cursor = new Date(start);
      while (cursor <= end) {
        if (cursor >= from && cursor <= to) {
          result.add(formatDateKey(cursor));
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }
  }

  return result;
}

/**
 * Shu oydagi darslar sonini hisoblash (bayram/dam olish kunlari chiqarib tashlanadi)
 */
export async function countLessonsInMonth(
  year: number,
  month: number,
  days: number[],
): Promise<number> {
  if (!days || days.length === 0) return 0;

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0); // oxirgi kun

  // Shu oydagi bayram sanalarini olish
  const holidayDates = await getHolidayDatesInRange(monthStart, monthEnd);

  const daysInMonth = monthEnd.getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const weekday = date.getDay(); // 0=Yak, 1=Du...
    if (days.includes(weekday)) {
      // Bayram sanasiga tushsa — sanama
      const key = formatDateKey(date);
      if (!holidayDates.has(key)) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Bir sanani bayram/dam olish kuniga to'g'ri kelishini tekshirish
 */
export async function isHolidayDate(date: Date): Promise<{ isHoliday: boolean; holidayName?: string }> {
  const dateKey = formatDateKey(date);
  const dateMonth = date.getMonth();
  const dateDay = date.getDate();

  const holidays = await prisma.holiday.findMany({
    where: {
      OR: [
        // Aniq sana yoki oraliqda
        { date: { lte: date }, endDate: { gte: date } },
        { date: { equals: date }, endDate: null },
        // Recurring
        { isRecurring: true },
      ],
    },
  });

  for (const h of holidays) {
    if (h.isRecurring) {
      const start = new Date(date.getFullYear(), h.date.getMonth(), h.date.getDate());
      const end = h.endDate
        ? new Date(date.getFullYear(), h.endDate.getMonth(), h.endDate.getDate())
        : start;
      if (date >= start && date <= end) {
        return { isHoliday: true, holidayName: h.name };
      }
    } else {
      const start = new Date(h.date);
      const end = h.endDate ? new Date(h.endDate) : start;
      if (date >= start && date <= end) {
        return { isHoliday: true, holidayName: h.name };
      }
    }
  }

  return { isHoliday: false };
}

/** YYYY-MM-DD formatidagi kalit */
function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
