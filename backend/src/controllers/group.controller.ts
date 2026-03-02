import prisma from '../lib/prisma';
import { Response } from 'express';
import { AuthRequest } from '../types';
import { sendSuccess, sendError, paginate } from '../utils/response.utils';


const groupInclude = {
  course: { select: { id: true, name: true, monthlyPrice: true, description: true } },
  teacher: {
    include: { user: { select: { id: true, fullName: true, phone: true, avatarUrl: true } } }
  },
  schedules: { orderBy: { id: 'asc' as const } },
  _count: {
    select: { groupStudents: { where: { status: 'ACTIVE' as const } }, lessons: true }
  }
};

// ══════════════════════════════════════════════
// GET /groups
// ══════════════════════════════════════════════
export const getGroups = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1', limit = '20', search = '',
      status, courseId, teacherId
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (courseId) where.courseId = parseInt(courseId);
    if (teacherId) where.teacherId = parseInt(teacherId);
    if (search) where.name = { contains: search, mode: 'insensitive' };

    // Ustoz faqat o'z guruhlarini ko'radi
    if (req.user?.role === 'TEACHER') {
      const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
      if (teacher) where.teacherId = teacher.id;
    }

    // O'quvchi faqat o'z guruhlarini ko'radi
    if (req.user?.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
      if (student) {
        where.groupStudents = { some: { studentId: student.id, status: 'ACTIVE' } };
      }
    }

    // Ota-ona faqat farzandining guruhlarini ko'radi
    // Student.parentId = ota-onaning User.id si
    if (req.user?.role === 'PARENT') {
      const children = await prisma.student.findMany({
        where: { parentId: req.user.id },
        select: { id: true },
      });
      const childIds = children.map((c) => c.id);
      if (childIds.length > 0) {
        where.groupStudents = { some: { studentId: { in: childIds }, status: 'ACTIVE' } };
      } else {
        // Farzand yo'q bo'lsa — bo'sh ro'yxat
        where.id = -1;
      }
    }

    const [groups, total] = await Promise.all([
      prisma.group.findMany({ where, include: groupInclude, skip, take: limitNum, orderBy: { createdAt: 'desc' } }),
      prisma.group.count({ where })
    ]);

    sendSuccess(res, groups, undefined, 200, paginate(pageNum, limitNum, total));
  } catch (err) {
    console.error('getGroups error:', err);
    sendError(res, 'Guruhlarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /groups/:id
// ══════════════════════════════════════════════
export const getGroupById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        ...groupInclude,
        groupStudents: {
          where: { status: 'ACTIVE' },
          include: {
            student: {
              include: {
                user: { select: { id: true, fullName: true, phone: true, avatarUrl: true } },
                balance: true,
              }
            }
          },
          orderBy: { joinedAt: 'asc' }
        },
        schedules: { orderBy: { id: 'asc' } },
        lessons: {
          take: 10,
          orderBy: { date: 'desc' },
          include: { _count: { select: { attendance: true, grades: true } } }
        }
      }
    });

    if (!group) {
      sendError(res, 'Guruh topilmadi.', 404);
      return;
    }

    sendSuccess(res, group);
  } catch (err) {
    console.error('getGroupById error:', err);
    sendError(res, 'Guruhni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// POST /groups
// ══════════════════════════════════════════════
export const createGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name, courseId, teacherId, maxStudents = 15,
      startDate, endDate, room, schedules // [{dayOfWeek, startTime, endTime}]
    } = req.body;

    if (!name || !courseId || !teacherId) {
      sendError(res, 'Nom, kurs va ustoz kiritilishi shart.', 400);
      return;
    }

    // Guruh nomi unikal
    const existing = await prisma.group.findFirst({ where: { name, status: 'ACTIVE' } });
    if (existing) {
      sendError(res, 'Bu nomli faol guruh allaqachon mavjud.', 409);
      return;
    }

    const group = await prisma.$transaction(async (tx) => {
      const g = await tx.group.create({
        data: {
          name,
          courseId: parseInt(courseId),
          teacherId: parseInt(teacherId),
          maxStudents: parseInt(maxStudents),
          startDate: startDate ? new Date(startDate) : new Date(),
          endDate: endDate ? new Date(endDate) : undefined,
          room,
          status: 'ACTIVE',
        },
        include: groupInclude
      });

      // Jadval yaratish
      if (schedules && Array.isArray(schedules)) {
        await tx.schedule.createMany({
          data: schedules.map((sc: { daysOfWeek: number[]; startTime: string; endTime: string; room?: string }) => ({
            groupId: g.id,
            daysOfWeek: sc.daysOfWeek || [],
            startTime: sc.startTime,
            endTime: sc.endTime,
            room: sc.room || room || undefined,
          }))
        });
      }

      return g;
    });

    sendSuccess(res, group, 'Guruh muvaffaqiyatli yaratildi!', 201);
  } catch (err) {
    console.error('createGroup error:', err);
    sendError(res, 'Guruh yaratishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// PUT /groups/:id
// ══════════════════════════════════════════════
export const updateGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { name, courseId, teacherId, maxStudents, startDate, endDate, room, status } = req.body;

    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) {
      sendError(res, 'Guruh topilmadi.', 404);
      return;
    }

    const updated = await prisma.group.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(courseId && { courseId: parseInt(courseId) }),
        ...(teacherId && { teacherId: parseInt(teacherId) }),
        ...(maxStudents && { maxStudents: parseInt(maxStudents) }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(room !== undefined && { room }),
        ...(status && { status }),
      },
      include: groupInclude
    });

    sendSuccess(res, updated, 'Guruh yangilandi.');
  } catch (err) {
    console.error('updateGroup error:', err);
    sendError(res, 'Guruhni yangilashda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// DELETE /groups/:id
// ══════════════════════════════════════════════
export const deleteGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    const group = await prisma.group.findUnique({
      where: { id },
      include: { _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } } }
    });

    if (!group) {
      sendError(res, 'Guruh topilmadi.', 404);
      return;
    }

    if (group._count.groupStudents > 0) {
      sendError(res, `Guruhda ${group._count.groupStudents} ta faol o'quvchi bor. Avval ularni chiqaring.`, 400);
      return;
    }

    // Status COMPLETED qilib, o'chirmaymiz (arxiv)
    await prisma.group.update({
      where: { id },
      data: { status: 'COMPLETED' }
    });

    sendSuccess(res, null, 'Guruh yopildi.');
  } catch (err) {
    console.error('deleteGroup error:', err);
    sendError(res, 'Guruhni yopishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// POST /groups/:id/schedules — Jadval qo'shish
// ══════════════════════════════════════════════
export const addSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.params.id);
    const { daysOfWeek, startTime, duration, room } = req.body;

    if (!daysOfWeek || !Array.isArray(daysOfWeek) || daysOfWeek.length === 0 || !startTime || !duration) {
      sendError(res, 'Kunlar, boshlanish vaqti va davomiyligi kiritilishi shart.', 400);
      return;
    }

    // endTime hisoblash
    const [h, m] = startTime.split(':').map(Number);
    const totalMins = h * 60 + m + parseInt(duration);
    const endTime = `${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`;

    // Xona band tekshirish
    if (room) {
      const conflict = await prisma.schedule.findFirst({
        where: {
          room,
          group: { status: 'ACTIVE' },
          daysOfWeek: { hasSome: daysOfWeek },
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gt: startTime } },
          ]
        },
        include: { group: { select: { name: true } } }
      });
      if (conflict) {
        sendError(res, `"${room}" xonasi ${conflict.startTime}–${conflict.endTime} vaqtida "${conflict.group.name}" guruhi uchun band.`, 409);
        return;
      }
    }

    const schedule = await prisma.schedule.create({
      data: { groupId, daysOfWeek, startTime, endTime, room: room || null }
    });

    sendSuccess(res, { ...schedule, duration: parseInt(duration) }, 'Jadval qo\'shildi!', 201);
  } catch (err) {
    console.error('addSchedule error:', err);
    sendError(res, 'Jadval qo\'shishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// PUT /groups/:id/schedules/:scheduleId
// ══════════════════════════════════════════════
export const updateSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.params.id);
    const scheduleId = parseInt(req.params.scheduleId);
    const { daysOfWeek, startTime, duration, room } = req.body;

    if (!startTime || !duration) {
      sendError(res, 'Boshlanish vaqti va davomiylik kiritilishi shart.', 400);
      return;
    }

    const [h, m] = startTime.split(':').map(Number);
    const totalMins = h * 60 + m + parseInt(duration);
    const endTime = `${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`;

    // Xona band tekshirish (o'zini chiqarib)
    if (room) {
      const conflict = await prisma.schedule.findFirst({
        where: {
          id: { not: scheduleId },
          room,
          group: { status: 'ACTIVE' },
          daysOfWeek: { hasSome: daysOfWeek || [] },
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gt: startTime } },
          ]
        },
        include: { group: { select: { name: true } } }
      });
      if (conflict) {
        sendError(res, `"${room}" xonasi ${conflict.startTime}–${conflict.endTime} vaqtida "${conflict.group.name}" guruhi uchun band.`, 409);
        return;
      }
    }

    const updated = await prisma.schedule.update({
      where: { id: scheduleId, groupId },
      data: { ...(daysOfWeek && { daysOfWeek }), startTime, endTime, room: room || null }
    });

    sendSuccess(res, updated, 'Jadval yangilandi.');
  } catch (err) {
    console.error('updateSchedule error:', err);
    sendError(res, 'Jadvalni yangilashda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// DELETE /groups/:id/schedules/:scheduleId
// ══════════════════════════════════════════════
export const deleteSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.params.id);
    const scheduleId = parseInt(req.params.scheduleId);
    await prisma.schedule.delete({ where: { id: scheduleId, groupId } });
    sendSuccess(res, null, 'Jadval o\'chirildi.');
  } catch (err) {
    console.error('deleteSchedule error:', err);
    sendError(res, 'Jadvalni o\'chirishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// POST /groups/:id/students — O'quvchi qo'shish
// ══════════════════════════════════════════════
export const addStudentToGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.params.id);
    const { studentId } = req.body;
    if (!studentId) { sendError(res, 'studentId kiritilishi shart.', 400); return; }

    const group = await prisma.group.findUnique({ where: { id: groupId }, include: { _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } } } });
    if (!group) { sendError(res, 'Guruh topilmadi.', 404); return; }
    if (group._count.groupStudents >= group.maxStudents) {
      sendError(res, `Guruh to'lgan (${group.maxStudents} ta max).`, 400); return;
    }

    const existing = await prisma.groupStudent.findUnique({ where: { groupId_studentId: { groupId, studentId: parseInt(studentId) } } });
    if (existing) {
      if (existing.status === 'ACTIVE') { sendError(res, 'O\'quvchi allaqachon bu guruhda.', 409); return; }
      const updated = await prisma.groupStudent.update({ where: { id: existing.id }, data: { status: 'ACTIVE', joinedAt: new Date() } });
      sendSuccess(res, updated, 'O\'quvchi guruhga qaytarildi.', 201);
      return;
    }

    const gs = await prisma.groupStudent.create({ data: { groupId, studentId: parseInt(studentId), joinedAt: new Date() } });
    sendSuccess(res, gs, 'O\'quvchi guruhga qo\'shildi!', 201);
  } catch (err) {
    console.error('addStudentToGroup error:', err);
    sendError(res, 'O\'quvchi qo\'shishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// DELETE /groups/:id/students/:studentId — O'quvchini chiqarish
// ══════════════════════════════════════════════
export const removeStudentFromGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.params.id);
    const studentId = parseInt(req.params.studentId);
    await prisma.groupStudent.updateMany({
      where: { groupId, studentId },
      data: { status: 'LEFT' }
    });
    sendSuccess(res, null, 'O\'quvchi guruhdan chiqarildi.');
  } catch (err) {
    console.error('removeStudentFromGroup error:', err);
    sendError(res, 'O\'quvchini chiqarishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// POST /groups/:id/students/:studentId/transfer — O'tkazish
// ══════════════════════════════════════════════
export const transferStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const fromGroupId = parseInt(req.params.id);
    const studentId = parseInt(req.params.studentId);
    const { toGroupId } = req.body;
    if (!toGroupId) { sendError(res, 'toGroupId kiritilishi shart.', 400); return; }

    const toGroup = await prisma.group.findUnique({ where: { id: parseInt(toGroupId) }, include: { _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } } } });
    if (!toGroup) { sendError(res, 'Maqsad guruh topilmadi.', 404); return; }
    if (toGroup._count.groupStudents >= toGroup.maxStudents) {
      sendError(res, `"${toGroup.name}" guruhi to'lgan.`, 400); return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.groupStudent.updateMany({ where: { groupId: fromGroupId, studentId, status: 'ACTIVE' }, data: { status: 'LEFT' } });
      const existing = await tx.groupStudent.findUnique({ where: { groupId_studentId: { groupId: parseInt(toGroupId), studentId } } });
      if (existing) {
        await tx.groupStudent.update({ where: { id: existing.id }, data: { status: 'ACTIVE', joinedAt: new Date() } });
      } else {
        await tx.groupStudent.create({ data: { groupId: parseInt(toGroupId), studentId, joinedAt: new Date() } });
      }
    });

    sendSuccess(res, null, `O'quvchi "${toGroup.name}" guruhiga o'tkazildi.`);
  } catch (err) {
    console.error('transferStudent error:', err);
    sendError(res, 'O\'quvchini o\'tkazishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /groups/:id/stats — Guruh statistikasi
// ══════════════════════════════════════════════
export const getGroupStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.params.id);

    const [studentCount, totalLessons, avgAttendance, totalRevenue] = await Promise.all([
      prisma.groupStudent.count({ where: { groupId, status: 'ACTIVE' } }),
      prisma.lesson.count({ where: { groupId } }),
      prisma.attendance.aggregate({
        where: { lesson: { groupId }, status: 'PRESENT' },
        _count: true
      }),
      prisma.payment.aggregate({
        where: { student: { groupStudents: { some: { groupId } } } },
        _sum: { amount: true }
      })
    ]);

    const totalAttendance = await prisma.attendance.count({ where: { lesson: { groupId } } });
    const attendanceRate = totalAttendance > 0
      ? Math.round((avgAttendance._count / totalAttendance) * 100)
      : 0;

    sendSuccess(res, {
      studentCount,
      totalLessons,
      attendanceRate,
      totalRevenue: Number(totalRevenue._sum.amount || 0)
    });
  } catch (err) {
    console.error('getGroupStats error:', err);
    sendError(res, 'Statistikani olishda xato.', 500);
  }
};
