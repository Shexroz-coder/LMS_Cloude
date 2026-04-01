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
    const lessonDateObj = new Date(date);
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
    const lessonDate = new Date(date);
    const lessonsInMonth = await countLessonsInMonth(
      lessonDate.getFullYear(), lessonDate.getMonth(), scheduledDays
    );
    const basePricePerLesson = lessonsInMonth > 0 ? monthlyPrice / lessonsInMonth : 0;

    // Dars mavjudmi? (kuniga 1 ta dars)
    const dayStart = new Date(lessonDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(lessonDate);
    dayEnd.setHours(23, 59, 59, 999);

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
          date: new Date(date),
          startTime,
          endTime,
          topic: topic || undefined,
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
// GET /attendance/group/:groupId — Guruh davomati
// ══════════════════════════════════════════════
export const getGroupAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.params.groupId);
    const { month } = req.query as { month?: string };

    const startDate = month
      ? new Date(month + '-01')
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

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
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

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
    const startDate = month
      ? new Date(month + '-01')
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

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
    const total = records.length;
    const present = records.filter(r => r.status === 'PRESENT').length;
    sendSuccess(res, { records, total, present, rate: total > 0 ? Math.round(present / total * 100) : 0 });
  } catch (err) {
    console.error('getStudentAttendance error:', err);
    sendError(res, 'Davomatni olishda xato.', 500);
  }
};
