import prisma from '../lib/prisma';
import { Response } from 'express';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';
import { getIO } from '../services/io.service';
import { sendNotificationToUser } from '../socket';
import { countLessonsInMonth, isHolidayDate } from '../utils/schedule.utils';
import { sendDebtNotification as sendDebtTelegram, sendAttendanceNotification as sendAttendanceTelegram } from '../telegram/services/notify.service';

// ══════════════════════════════════════════════
// HELPER: O'quvchiga va ota-onasiga qarzdorlik xabari yuborish
// ══════════════════════════════════════════════
async function sendDebtNotification(
  studentId: number,
  debtAmount: number,
  studentUserId: number,
  parentId: number | null,
) {
  const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v));
  const title = "To'lov eslatmasi";
  const body = `Sizning hisobingizda ${fmt(debtAmount)} so'm qarz mavjud. Iltimos balansni to'ldiring.`;

  const io = getIO();
  const userIds = [studentUserId];
  if (parentId) userIds.push(parentId);

  for (const userId of userIds) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId,
          title,
          body,
          type: 'PAYMENT',
          actionUrl: '/payments',
        },
      });
      if (io) {
        sendNotificationToUser(io, userId, notification);
      }
    } catch (err) {
      console.error('sendDebtNotification error for userId:', userId, err);
    }
  }
}


// ══════════════════════════════════════════════
// POST /attendance/lesson — Dars yaratish + davomat belgilash + avtomatik to'lov yechish
// ══════════════════════════════════════════════
export const markAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupId, date, topic, startTime = '09:00', endTime = '10:00', attendanceList, forcedLesson } = req.body;
    // attendanceList: [{studentId, status: 'PRESENT'|'ABSENT'|'LATE'|'EXCUSED', score?, note?}]
    // forcedLesson: boolean — bayram/dam olish kunida majburiy dars o'tkazish

    if (!groupId || !date || !attendanceList) {
      sendError(res, "Guruh, sana va davomat ro'yxati kiritilishi shart.", 400);
      return;
    }
    // ═══ BAYRAM/DAM OLISH KUNI TEKSHIRUVI ═══
    // date ni 'YYYY-MM-DD' string sifatida ishlatamiz — UTC midnight
    const dateStr = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date(date).toISOString().slice(0, 10);

    // Topic ixtiyoriy — bo'sh bo'lsa avtomatik generatsiya
    const finalTopic = (topic && String(topic).trim())
      ? String(topic).trim()
      : `${dateStr} darsi`;
    const lessonDateObj = new Date(dateStr + 'T00:00:00.000Z');
    const holidayCheck = await isHolidayDate(lessonDateObj);
    if (holidayCheck.isHoliday && !forcedLesson) {
      sendError(res, `Bu kun dam olish kuni: "${holidayCheck.holidayName}". Dars o'tkazish uchun "forcedLesson: true" yuboring.`, 400);
      return;
    }
    const isForcedHolidayLesson = holidayCheck.isHoliday && forcedLesson === true;

    const parsedGroupId = parseInt(groupId);

    // Ustozni tekshirish
    if (req.user?.role === 'TEACHER') {
      const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
      if (!teacher) { sendError(res, 'Ustoz topilmadi.', 403); return; }

      const group = await prisma.group.findUnique({ where: { id: parsedGroupId } });
      if (!group || group.teacherId !== teacher.id) {
        sendError(res, "Bu guruh sizning guruhingiz emas.", 403);
        return;
      }
    }

    // Guruh va kurs ma'lumotlari (dars narxini hisoblash uchun)
    const group = await prisma.group.findUnique({
      where: { id: parsedGroupId },
      include: {
        course: { select: { name: true, monthlyPrice: true } },
        schedules: { select: { daysOfWeek: true } },
      },
    });

    if (!group) { sendError(res, 'Guruh topilmadi.', 404); return; }

    // 1 darslik narxni hisoblash
    const monthlyPrice = Number(group.course.monthlyPrice);
    const scheduledDays = [...new Set(group.schedules.flatMap(s => s.daysOfWeek))];
    const lessonDate = lessonDateObj; // UTC midnight of the lesson date
    const lessonsInMonth = await countLessonsInMonth(
      lessonDate.getUTCFullYear(), lessonDate.getUTCMonth(), scheduledDays
    );
    const basePricePerLesson = lessonsInMonth > 0 ? monthlyPrice / lessonsInMonth : 0;

    // Dars mavjudmi? (kuniga 1 ta dars) — UTC based range
    const dayStart = new Date(dateStr + 'T00:00:00.000Z');
    const dayEnd   = new Date(dateStr + 'T23:59:59.999Z');

    let lesson = await prisma.lesson.findFirst({
      where: {
        groupId: parsedGroupId,
        date: { gte: dayStart, lt: dayEnd }
      }
    });

    if (!lesson) {
      lesson = await prisma.lesson.create({
        data: {
          groupId: parsedGroupId,
          date: lessonDate,
          startTime,
          endTime,
          topic: finalTopic,
          isForcedHoliday: isForcedHolidayLesson,
        }
      });
    }

    // Davomatni belgilash + avtomatik to'lov yechish
    const debtStudents: { studentId: number; studentUserId: number; parentId: number | null; debt: number }[] = [];

    const results = await Promise.all(
      (attendanceList as Array<{ studentId: number; status: string; score?: number; note?: string }>)
        .map(async (entry) => {
          // Avval davomat borligini tekshirish
          const existing = await prisma.attendance.findFirst({
            where: { lessonId: lesson!.id, studentId: entry.studentId }
          });

          if (existing) {
            // Mavjud davomatni yangilash (qayta to'lov yechilmaydi)
            return prisma.attendance.update({
              where: { id: existing.id },
              data: {
                status: entry.status as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED',
                note: entry.note,
              }
            });
          }

          // Yangi davomat yaratish
          const att = await prisma.attendance.create({
            data: {
              lessonId: lesson!.id,
              studentId: entry.studentId,
              status: entry.status as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED',
              note: entry.note,
            }
          });

          // ═══ AVTOMATIK TO'LOV YECHISH ═══
          // Faqat kelgan (PRESENT, LATE, EXCUSED) o'quvchilar uchun dars narxi yechiladi
          // MUHIM: Bayram kunida majburiy darsda pul yechilMAYDI!
          if (['PRESENT', 'LATE', 'EXCUSED'].includes(entry.status) && basePricePerLesson > 0 && !isForcedHolidayLesson) {
            // O'quvchi ma'lumotlarini olish (chegirma hisoblash uchun)
            const student = await prisma.student.findUnique({
              where: { id: entry.studentId },
              select: {
                userId: true,
                parentId: true,
                discountType: true,
                discountValue: true,
                balance: true,
                groupStudents: {
                  where: { groupId: parsedGroupId, status: 'ACTIVE' },
                  select: { joinedAt: true },
                },
              },
            });

            if (student) {
              // O'quvchi guruhga qo'shilgan sanasidan keyin kelgan darslarni hisoblash
              const gs = student.groupStudents[0];
              if (gs) {
                const joinedAt = new Date(gs.joinedAt);
                // Agar dars sanasi o'quvchi qo'shilgan sanadan oldin bo'lsa — yechilmaydi
                if (lessonDate >= joinedAt) {
                  // Chegirmani hisobga olish
                  let pricePerLesson = basePricePerLesson;
                  if (student.discountType && student.discountValue) {
                    if (student.discountType === 'PERCENTAGE') {
                      const discount = basePricePerLesson * (Number(student.discountValue) / 100);
                      pricePerLesson = basePricePerLesson - discount;
                    } else {
                      // FIXED_AMOUNT: oylik chegirmani darslar soniga bo'lish
                      const discountPerLesson = lessonsInMonth > 0
                        ? Math.min(Number(student.discountValue), monthlyPrice) / lessonsInMonth
                        : 0;
                      pricePerLesson = basePricePerLesson - discountPerLesson;
                    }
                    pricePerLesson = Math.max(0, pricePerLesson);
                  }

                  const deductAmount = Math.round(pricePerLesson * 100) / 100; // 2 xonagacha

                  if (deductAmount > 0) {
                    // Balansdan yechish
                    const currentBalance = Number(student.balance?.balance || 0);
                    const currentDebt = Number(student.balance?.debt || 0);

                    let newBalance = currentBalance;
                    let newDebt = currentDebt;

                    if (currentBalance >= deductAmount) {
                      // Balansdan to'liq yechish
                      newBalance = currentBalance - deductAmount;
                    } else {
                      // Balans yetmaydi — qoldiqni qarz qilish
                      const shortfall = deductAmount - currentBalance;
                      newBalance = 0;
                      newDebt = currentDebt + shortfall;
                    }

                    // Balansni yangilash
                    if (student.balance) {
                      await prisma.studentBalance.update({
                        where: { studentId: entry.studentId },
                        data: { balance: newBalance, debt: newDebt },
                      });
                    } else {
                      // Balans hali yaratilmagan bo'lsa
                      await prisma.studentBalance.create({
                        data: { studentId: entry.studentId, balance: newBalance, debt: newDebt },
                      });
                    }

                    // Agar qarz paydo bo'lsa — eslatma yuboramiz
                    if (newDebt > 0) {
                      debtStudents.push({
                        studentId: entry.studentId,
                        studentUserId: student.userId,
                        parentId: student.parentId,
                        debt: newDebt,
                      });
                    }
                  }
                }
              }
            }
          }

          return att;
        })
    );

    // Qarzdor o'quvchilarga eslatma yuborish (async — javob kutilmaydi)
    if (debtStudents.length > 0) {
      setImmediate(() => {
        for (const ds of debtStudents) {
          sendDebtNotification(ds.studentId, ds.debt, ds.studentUserId, ds.parentId)
            .catch(err => console.error('Debt notification error:', err));
          // Telegram ga ham yuborish
          sendDebtTelegram(ds.studentId, ds.debt, group.course.name)
            .catch(err => console.error('Telegram debt notification error:', err));
        }
      });
    }

    // Telegram — davomat xabarlarini yuborish
    setImmediate(() => {
      for (const att of attendanceList as Array<{ status: string; studentId: number }>) {
        sendAttendanceTelegram(att.studentId, att.status, group.course.name, lesson.date)
          .catch(err => console.error('Telegram attendance notification error:', err));
      }
    });

    sendSuccess(res, {
      lessonId: lesson.id,
      date: lesson.date,
      totalMarked: results.length,
      presentCount: (attendanceList as Array<{ status: string }>).filter(a => a.status === 'PRESENT' || a.status === 'LATE').length,
      isForcedHoliday: isForcedHolidayLesson,
      deductedCount: debtStudents.length > 0
        ? `${debtStudents.length} ta o'quvchida qarz paydo bo'ldi`
        : isForcedHolidayLesson
        ? 'Dam olish kuni — pul yechilmadi'
        : undefined,
    }, isForcedHolidayLesson ? 'Majburiy dars belgilandi (pul yechilmadi)!' : 'Davomat belgilandi!', 201);
  } catch (err) {
    console.error('markAttendance error:', err);
    sendError(res, 'Davomatni belgilashda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /attendance/calendar/:groupId — Kalendar uchun guruh + darslar
// ══════════════════════════════════════════════
export const getAttendanceCalendar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.params.groupId);
    const { month } = req.query as { month?: string };

    const now = new Date();
    const [gy, gm] = month
      ? month.split('-').map(Number)
      : [now.getFullYear(), now.getMonth() + 1];
    const startDate = new Date(Date.UTC(gy, gm - 1, 1));
    const endDate   = new Date(Date.UTC(gy, gm, 0, 23, 59, 59, 999));

    // Guruh + jadvallar + faol o'quvchilar
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        course: { select: { name: true, monthlyPrice: true } },
        schedules: { select: { daysOfWeek: true, startTime: true, endTime: true } },
        groupStudents: {
          where: { status: 'ACTIVE' },
          orderBy: { joinedAt: 'asc' },
          select: {
            student: {
              select: {
                id: true,
                coinBalance: true,
                user: { select: { id: true, fullName: true, avatarUrl: true } },
              }
            }
          }
        }
      }
    });

    if (!group) { sendError(res, 'Guruh topilmadi.', 404); return; }

    // O'sha oy uchun darslar
    const lessons = await prisma.lesson.findMany({
      where: { groupId, date: { gte: startDate, lte: endDate } },
      include: {
        attendance: {
          select: { studentId: true, status: true }
        }
      },
      orderBy: { date: 'asc' }
    });

    // Darslarni sodda formatga keltirish
    const totalStudents = group.groupStudents.length;
    const lessonSummary = lessons.map(l => {
      const present = l.attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
      const absent  = l.attendance.filter(a => a.status === 'ABSENT').length;
      const excused = l.attendance.filter(a => a.status === 'EXCUSED').length;
      return {
        id:             l.id,
        date:           l.date.toISOString().split('T')[0],
        presentCount:   present,
        absentCount:    absent,
        excusedCount:   excused,
        totalStudents,
        attendance:     l.attendance, // [{studentId, status}]
      };
    });

    sendSuccess(res, { group, lessons: lessonSummary });
  } catch (err) {
    console.error('getAttendanceCalendar error:', err);
    sendError(res, 'Kalendar ma\'lumotini olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /attendance/group/:groupId — Guruh davomati
// ══════════════════════════════════════════════
export const getGroupAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.params.groupId);
    const { month } = req.query as { month?: string };

    const now = new Date();
    const [gy, gm] = month
      ? month.split('-').map(Number)
      : [now.getFullYear(), now.getMonth() + 1];
    const startDate = new Date(Date.UTC(gy, gm - 1, 1));
    const endDate   = new Date(Date.UTC(gy, gm, 0, 23, 59, 59, 999));

    const lessons = await prisma.lesson.findMany({
      where: { groupId, date: { gte: startDate, lte: endDate } },
      include: {
        attendance: {
          include: {
            student: { include: { user: { select: { id: true, fullName: true } } } }
          }
        },
        _count: { select: { attendance: true } }
      },
      orderBy: { date: 'asc' }
    });

    sendSuccess(res, lessons);
  } catch (err) {
    console.error('getGroupAttendance error:', err);
    sendError(res, 'Davomatni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /attendance/today — Bugungi davomatni boshlatish
// ══════════════════════════════════════════════
export const getTodayAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // TZ=Asia/Tashkent — local getters return Tashkent date
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const start = new Date(todayStr + 'T00:00:00.000Z');
    const end   = new Date(todayStr + 'T23:59:59.999Z');

    let teacherWhere = {};
    if (req.user?.role === 'TEACHER') {
      const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
      if (teacher) teacherWhere = { group: { teacherId: teacher.id } };
    }

    const lessons = await prisma.lesson.findMany({
      where: { date: { gte: start, lte: end }, ...teacherWhere },
      include: {
        group: {
          include: {
            course: { select: { name: true } },
            teacher: { include: { user: { select: { fullName: true } } } },
            groupStudents: {
              where: { status: 'ACTIVE' },
              include: {
                student: {
                  include: { user: { select: { id: true, fullName: true, avatarUrl: true } } }
                }
              }
            }
          }
        },
        attendance: true,
        _count: { select: { attendance: true } }
      }
    });

    sendSuccess(res, lessons);
  } catch (err) {
    console.error('getTodayAttendance error:', err);
    sendError(res, 'Bugungi davomatni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /attendance/stats — Umumiy davomat statistikasi
// ══════════════════════════════════════════════
export const getAttendanceStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, groupId } = req.query as Record<string, string>;
    const sn = new Date();
    const [sy, sm] = month
      ? month.split('-').map(Number)
      : [sn.getFullYear(), sn.getMonth() + 1];
    const startDate = new Date(Date.UTC(sy, sm - 1, 1));
    const endDate   = new Date(Date.UTC(sy, sm, 0, 23, 59, 59, 999));

    const where: Record<string, unknown> = { lesson: { date: { gte: startDate, lte: endDate } } };
    if (groupId) where.lesson = { ...where.lesson as object, groupId: parseInt(groupId) };

    const [total, present, late, absent, excused] = await Promise.all([
      prisma.attendance.count({ where }),
      prisma.attendance.count({ where: { ...where, status: 'PRESENT' } }),
      prisma.attendance.count({ where: { ...where, status: 'LATE' } }),
      prisma.attendance.count({ where: { ...where, status: 'ABSENT' } }),
      prisma.attendance.count({ where: { ...where, status: 'EXCUSED' } }),
    ]);

    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    sendSuccess(res, { total, present, late, absent, excused, rate });
  } catch (err) {
    console.error('getAttendanceStats error:', err);
    sendError(res, 'Statistikani olishda xato.', 500);
  }
};

// GET /attendance/student/:studentId
export const getStudentAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.studentId);

    // Xavfsizlik: STUDENT faqat o'zini ko'ra oladi
    if (req.user?.role === 'STUDENT') {
      const myStudent = await prisma.student.findUnique({ where: { userId: req.user.id }, select: { id: true } });
      if (!myStudent || myStudent.id !== studentId) {
        sendError(res, "Siz faqat o'z davomatingizni ko'ra olasiz.", 403);
        return;
      }
    }

    // Xavfsizlik: PARENT faqat o'z farzandini ko'ra oladi
    if (req.user?.role === 'PARENT') {
      const myChildren = await prisma.student.findMany({ where: { parentId: req.user.id }, select: { id: true } });
      if (!myChildren.some(c => c.id === studentId)) {
        sendError(res, "Siz faqat o'z farzandingiz davomatini ko'ra olasiz.", 403);
        return;
      }
    }

    const { limit = '50' } = req.query as Record<string, string>;
    const records = await prisma.attendance.findMany({
      where: { studentId },
      include: { lesson: { select: { date: true, topic: true, group: { select: { name: true } } } } },
      orderBy: { lesson: { date: 'desc' } },
      take: parseInt(limit)
    });
    const total   = records.length;
    const present = records.filter(r => r.status === 'PRESENT').length;
    const late    = records.filter(r => r.status === 'LATE').length;
    const absent  = records.filter(r => r.status === 'ABSENT').length;
    const excused = records.filter(r => r.status === 'EXCUSED').length;
    // LATE ham kelgan hisoblanadi — davomat % da hisobga olinadi
    const rate = total > 0 ? Math.round((present + late) / total * 100) : 0;
    sendSuccess(res, { records, total, present, late, absent, excused, rate });
  } catch (err) {
    console.error('getStudentAttendance error:', err);
    sendError(res, 'Davomatni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /attendance/teacher-report — Ustozlar davomat nazorati (ADMIN)
// Rejalashtirilgan BARCHA kunlarni ko'rsatadi — dars yaratilmagan kunlar ham
// ══════════════════════════════════════════════
export const getTeacherAttendanceReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date, month } = req.query as Record<string, string>;

    let startDate: Date;
    let endDate: Date;

    // Bugungi Toshkent sanasi (TZ=Asia/Tashkent)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayEnd = new Date(todayStr + 'T23:59:59.999Z');

    if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      startDate = new Date(Date.UTC(year, monthNum - 1, 1));
      endDate   = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));
    } else if (date) {
      const ds = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date(date).toISOString().slice(0, 10);
      startDate = new Date(ds + 'T00:00:00.000Z');
      endDate   = new Date(ds + 'T23:59:59.999Z');
    } else {
      startDate = new Date(todayStr + 'T00:00:00.000Z');
      endDate   = new Date(todayStr + 'T23:59:59.999Z');
    }

    // Kelajak kunlarni ko'rsatmaylik — bugun bilan cheklaymiz
    const rangeEnd = endDate < todayEnd ? endDate : todayEnd;

    // Barcha faol guruhlarni jadval, ustoz va o'quvchi soni bilan olish
    const groups = await prisma.group.findMany({
      where: { status: 'ACTIVE' },
      include: {
        teacher: { include: { user: { select: { id: true, fullName: true } } } },
        course: { select: { name: true } },
        schedules: { select: { daysOfWeek: true } },
        groupStudents: { where: { status: 'ACTIVE' }, select: { id: true } },
      },
    });

    // Diapazon ichidagi barcha darslarni olish
    const lessons = await prisma.lesson.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      include: { _count: { select: { attendance: true } } },
    });

    // Tez qidirish uchun map: "groupId_YYYY-MM-DD" → lesson
    const lessonByKey = new Map<string, typeof lessons[0]>();
    for (const lesson of lessons) {
      const key = `${lesson.groupId}_${lesson.date.toISOString().slice(0, 10)}`;
      lessonByKey.set(key, lesson);
    }

    interface TeacherReport {
      teacherId: number;
      teacherName: string;
      lessons: Array<{
        lessonId: number | null;
        date: Date;
        groupName: string;
        courseName: string;
        totalStudents: number;
        markedCount: number;
        isMarked: boolean;
      }>;
    }

    const reportMap = new Map<number, TeacherReport>();

    for (const group of groups) {
      // Bu guruh uchun rejalashtirilgan hafta kunlari (0=Yakshanba...6=Shanba)
      const scheduledDayNums = new Set(group.schedules.flatMap(s => s.daysOfWeek));
      if (scheduledDayNums.size === 0) continue;

      const teacherId   = group.teacher.id;
      const teacherName = group.teacher.user.fullName;
      if (!reportMap.has(teacherId)) {
        reportMap.set(teacherId, { teacherId, teacherName, lessons: [] });
      }
      const report = reportMap.get(teacherId)!;

      // Diapazon ichidagi har bir kunni tekshirish
      const current = new Date(startDate);
      while (current <= rangeEnd) {
        const dow = current.getUTCDay(); // UTC getters — DB UTC midnight bilan mos
        if (scheduledDayNums.has(dow)) {
          const dateKey = current.toISOString().slice(0, 10);
          const lesson  = lessonByKey.get(`${group.id}_${dateKey}`);
          report.lessons.push({
            lessonId:      lesson?.id ?? null,
            date:          new Date(current),
            groupName:     group.name,
            courseName:    group.course.name,
            totalStudents: group.groupStudents.length,
            markedCount:   lesson?._count.attendance ?? 0,
            isMarked:      (lesson?._count.attendance ?? 0) > 0,
          });
        }
        current.setUTCDate(current.getUTCDate() + 1);
      }
    }

    const teachers = Array.from(reportMap.values());

    // Har bir ustoz darslarini sanasi bo'yicha kamayib tartibla
    for (const t of teachers) {
      t.lessons.sort((a, b) => b.date.getTime() - a.date.getTime());
    }

    const allScheduled    = teachers.flatMap(t => t.lessons);
    const totalLessons    = allScheduled.length;
    const markedLessons   = allScheduled.filter(l => l.isMarked).length;
    const unmarkedLessons = totalLessons - markedLessons;

    sendSuccess(res, {
      summary: {
        totalLessons,
        markedLessons,
        unmarkedLessons,
        dateRange: {
          from: startDate.toISOString().split('T')[0],
          to:   endDate.toISOString().split('T')[0],
        },
      },
      teachers: teachers.sort((a, b) => a.teacherName.localeCompare(b.teacherName)),
    });
  } catch (err) {
    console.error('getTeacherAttendanceReport error:', err);
    sendError(res, 'Davomat hisovatini olishda xato.', 500);
  }
};
