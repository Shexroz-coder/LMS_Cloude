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

/**
 * Shu oydagi STANDART darslar sonini hisoblash (bayramlarni HISOBGA OLMAYDI)
 * Bu "ideal" darslar soni — hech qanday dam olish kunlari bo'lmaganda
 */
export async function countStandardLessonsInMonth(
  year: number,
  month: number,
  days: number[],
): Promise<number> {
  if (!days || days.length === 0) return 0;

  const monthEnd = new Date(year, month + 1, 0);
  const daysInMonth = monthEnd.getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const weekday = date.getDay();
    if (days.includes(weekday)) {
      count++;
    }
  }
  return count;
}

/**
 * Dam olish kunlariga to'g'ri keladigan darslar sonini hisoblash
 * Qaytaradi: { holidayLessons: number, holidayDates: string[] }
 */
export async function countHolidayLessonsInMonth(
  year: number,
  month: number,
  days: number[],
): Promise<{ holidayLessons: number; holidayDates: string[] }> {
  if (!days || days.length === 0) return { holidayLessons: 0, holidayDates: [] };

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  const holidayDates = await getHolidayDatesInRange(monthStart, monthEnd);

  const daysInMonth = monthEnd.getDate();
  let count = 0;
  const affectedDates: string[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const weekday = date.getDay();
    if (days.includes(weekday)) {
      const key = formatDateKey(date);
      if (holidayDates.has(key)) {
        count++;
        affectedDates.push(key);
      }
    }
  }

  return { holidayLessons: count, holidayDates: affectedDates };
}

/**
 * Oyning to'liq kalendar ma'lumotlarini olish
 * Dars kunlari, dam olish kunlari, va ularning kesishishi
 */
export async function getMonthCalendarData(
  year: number,
  month: number,
  days: number[],
): Promise<{
  standardLessons: number;
  actualLessons: number;
  holidayLessons: number;
  calendarDays: Array<{
    date: string;
    dayOfWeek: number;
    isLessonDay: boolean;
    isHoliday: boolean;
    isHolidayLesson: boolean;  // dars kuni + dam olish kuni
    holidayName?: string;
  }>;
}> {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const daysInMonth = monthEnd.getDate();

  // Barcha bayram kunlarini olish
  const holidayDates = await getHolidayDatesInRange(monthStart, monthEnd);

  // Bayram nomlari uchun alohida so'rov
  const holidays = await prisma.holiday.findMany({
    where: {
      OR: [
        { date: { gte: monthStart, lte: monthEnd } },
        { date: { lte: monthEnd }, endDate: { gte: monthStart } },
        { isRecurring: true },
      ],
    },
  });

  // Sana → bayram nomi xaritasi
  const holidayNameMap = new Map<string, string>();
  for (const h of holidays) {
    if (h.isRecurring) {
      const start = new Date(year, h.date.getMonth(), h.date.getDate());
      const end = h.endDate ? new Date(year, h.endDate.getMonth(), h.endDate.getDate()) : start;
      const cursor = new Date(start);
      while (cursor <= end) {
        if (cursor >= monthStart && cursor <= monthEnd) {
          holidayNameMap.set(formatDateKey(cursor), h.name);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      const start = new Date(h.date);
      const end = h.endDate ? new Date(h.endDate) : start;
      const cursor = new Date(start);
      while (cursor <= end) {
        if (cursor >= monthStart && cursor <= monthEnd) {
          holidayNameMap.set(formatDateKey(cursor), h.name);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }
  }

  let standardLessons = 0;
  let holidayLessons = 0;
  const calendarDays: Array<{
    date: string;
    dayOfWeek: number;
    isLessonDay: boolean;
    isHoliday: boolean;
    isHolidayLesson: boolean;
    holidayName?: string;
  }> = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const weekday = date.getDay();
    const key = formatDateKey(date);
    const isLessonDay = days.includes(weekday);
    const isHoliday = holidayDates.has(key);
    const isHolidayLesson = isLessonDay && isHoliday;

    if (isLessonDay) standardLessons++;
    if (isHolidayLesson) holidayLessons++;

    calendarDays.push({
      date: key,
      dayOfWeek: weekday,
      isLessonDay,
      isHoliday,
      isHolidayLesson,
      ...(isHoliday ? { holidayName: holidayNameMap.get(key) } : {}),
    });
  }

  return {
    standardLessons,
    actualLessons: standardLessons - holidayLessons,
    holidayLessons,
    calendarDays,
  };
}

/**
 * Berilgan sanadan boshlab oy oxirigacha bo'lgan darslar sonini hisoblash (bayramlar chiqariladi)
 * Pro-rata hisoblash uchun — o'quvchi oyning o'rtasida qo'shilganda
 */
export async function countLessonsInMonthFromDate(
  year: number,
  month: number,
  days: number[],
  fromDate: Date,
): Promise<number> {
  if (!days || days.length === 0) return 0;

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  // fromDate shu oyda bo'lmasa, to'liq oy hisoblash
  const startDay = (fromDate.getFullYear() === year && fromDate.getMonth() === month)
    ? fromDate.getDate()
    : 1;

  const holidayDates = await getHolidayDatesInRange(monthStart, monthEnd);

  const daysInMonth = monthEnd.getDate();
  let count = 0;
  for (let d = startDay; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const weekday = date.getDay();
    if (days.includes(weekday)) {
      const key = formatDateKey(date);
      if (!holidayDates.has(key)) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Berilgan sanadan boshlab oy oxirigacha STANDART darslar soni (bayramlarsiz)
 */
export async function countStandardLessonsFromDate(
  year: number,
  month: number,
  days: number[],
  fromDate: Date,
): Promise<number> {
  if (!days || days.length === 0) return 0;

  const monthEnd = new Date(year, month + 1, 0);
  const startDay = (fromDate.getFullYear() === year && fromDate.getMonth() === month)
    ? fromDate.getDate()
    : 1;

  const daysInMonth = monthEnd.getDate();
  let count = 0;
  for (let d = startDay; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const weekday = date.getDay();
    if (days.includes(weekday)) {
      count++;
    }
  }
  return count;
}

/** YYYY-MM-DD formatidagi kalit */
function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
