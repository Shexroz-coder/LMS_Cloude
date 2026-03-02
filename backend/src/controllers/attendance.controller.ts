import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';

const prisma = new PrismaClient();

// ══════════════════════════════════════════════
// POST /attendance/lesson — Dars yaratish + davomat belgilash
// ══════════════════════════════════════════════
export const markAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupId, date, topic, startTime = '09:00', endTime = '10:00', attendanceList } = req.body;
    // attendanceList: [{studentId, status: 'PRESENT'|'ABSENT'|'LATE'|'EXCUSED', score?, note?}]

    if (!groupId || !date || !attendanceList) {
      sendError(res, "Guruh, sana va davomat ro'yxati kiritilishi shart.", 400);
      return;
    }

    // Ustozni tekshirish
    let teacherId: number | undefined;
    if (req.user?.role === 'TEACHER') {
      const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
      if (!teacher) { sendError(res, 'Ustoz topilmadi.', 403); return; }
      teacherId = teacher.id;

      // Bu grupning ustozimikan?
      const group = await prisma.group.findUnique({ where: { id: parseInt(groupId) } });
      if (!group || group.teacherId !== teacher.id) {
        sendError(res, "Bu guruh sizning guruhingiz emas.", 403);
        return;
      }
    }

    const lessonDate = new Date(date);

    // Dars mavjudmi? (kuniga 1 ta dars)
    let lesson = await prisma.lesson.findFirst({
      where: {
        groupId: parseInt(groupId),
        date: {
          gte: new Date(lessonDate.setHours(0, 0, 0, 0)),
          lt: new Date(lessonDate.setHours(23, 59, 59, 999))
        }
      }
    });

    if (!lesson) {
      lesson = await prisma.lesson.create({
        data: {
          groupId: parseInt(groupId),
          date: new Date(date),
          startTime,
          endTime,
          topic: topic || undefined,
        }
      });
    }

    // Davomatni belgilash
    const results = await Promise.all(
      (attendanceList as Array<{ studentId: number; status: string; score?: number; note?: string }>)
        .map(async (entry) => {
          const existing = await prisma.attendance.findFirst({
            where: { lessonId: lesson!.id, studentId: entry.studentId }
          });

          if (existing) {
            return prisma.attendance.update({
              where: { id: existing.id },
              data: {
                status: entry.status as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED',
                note: entry.note,
              }
            });
          }

          const att = await prisma.attendance.create({
            data: {
              lessonId: lesson!.id,
              studentId: entry.studentId,
              status: entry.status as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED',
              note: entry.note,
            }
          });

          // Baho ham kelgan bo'lsa
          if (entry.score !== undefined) {
            await prisma.grade.create({
              data: {
                lessonId: lesson!.id,
                studentId: entry.studentId,
                score: entry.score,
                type: 'CLASSWORK',
              }
            });
          }

          return att;
        })
    );

    sendSuccess(res, {
      lessonId: lesson.id,
      date: lesson.date,
      totalMarked: results.length,
      presentCount: (attendanceList as Array<{ status: string }>).filter(a => a.status === 'PRESENT' || a.status === 'LATE').length,
    }, 'Davomat belgilandi!', 201);
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
    const start = new Date(today.setHours(0, 0, 0, 0));
    const end = new Date(today.setHours(23, 59, 59, 999));

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
