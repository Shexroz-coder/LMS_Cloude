import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendSuccess, sendError } from '../utils/response.utils';
import { authorize } from '../middleware/auth.middleware';
import { AuthRequest } from '../types';
import lessonMaterialRoutes from './lesson-material.routes';

const prisma = new PrismaClient();
const router = Router({ mergeParams: true });

// ══════════════════════════════════════════════
// POST /lessons - Create a lesson
// ══════════════════════════════════════════════
router.post('/', authorize('ADMIN', 'TEACHER'), async (req: AuthRequest, res: Response) => {
  try {
    const { groupId, date, startTime, endTime, topic, homework } = req.body;
    if (!groupId || !date || !startTime || !endTime) {
      sendError(res, 'groupId, date, startTime, endTime kiritilishi shart', 400);
      return;
    }

    const parsedGroupId = parseInt(groupId);
    const lessonDate = new Date(date);

    // Check if lesson already exists for this group+date+time
    const existing = await prisma.lesson.findFirst({
      where: {
        groupId: parsedGroupId,
        date: {
          gte: new Date(lessonDate.setHours(0, 0, 0, 0)),
          lt: new Date(new Date(date).setHours(23, 59, 59, 999))
        },
        startTime
      }
    });

    if (existing) {
      sendSuccess(res, existing, 'Dars allaqachon mavjud', 200);
      return;
    }

    const lesson = await prisma.lesson.create({
      data: {
        groupId: parsedGroupId,
        date: new Date(date),
        startTime,
        endTime,
        topic: topic || undefined,
        homework: homework || undefined,
        status: 'COMPLETED',
        durationHours: 1.5,
      }
    });

    sendSuccess(res, lesson, 'Dars yaratildi!', 201);
  } catch (err) {
    console.error('createLesson error:', err);
    sendError(res, 'Dars yaratishda xato', 500);
  }
});

// ══════════════════════════════════════════════
// GET /lessons - List lessons
// ══════════════════════════════════════════════
router.get('/', authorize('ADMIN', 'TEACHER'), async (req: AuthRequest, res: Response) => {
  try {
    const { groupId, limit = '20' } = req.query as Record<string, string>;
    const lessons = await prisma.lesson.findMany({
      where: groupId ? { groupId: parseInt(groupId) } : {},
      include: {
        _count: { select: { attendance: true, grades: true } },
      },
      orderBy: { date: 'desc' },
      take: parseInt(limit)
    });
    sendSuccess(res, lessons);
  } catch (err) {
    console.error('getLesson error:', err);
    sendError(res, 'Darslarni olishda xato', 500);
  }
});

// ══════════════════════════════════════════════
// GET /lessons/:lessonId - Get single lesson
// ══════════════════════════════════════════════
router.get('/:lessonId', authorize('ADMIN', 'TEACHER', 'STUDENT'), async (req: AuthRequest, res: Response) => {
  try {
    const lessonId = parseInt(req.params.lessonId);
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        group: {
          include: {
            course: { select: { name: true } },
            teacher: { include: { user: { select: { fullName: true } } } }
          }
        },
        attendance: {
          include: {
            student: { include: { user: { select: { fullName: true } } } }
          }
        },
        grades: true,
        _count: { select: { attendance: true, grades: true } }
      }
    });

    if (!lesson) {
      sendError(res, 'Dars topilmadi', 404);
      return;
    }

    sendSuccess(res, lesson);
  } catch (err) {
    console.error('getLesson error:', err);
    sendError(res, 'Darsni olishda xato', 500);
  }
});

// ══════════════════════════════════════════════
// PUT /lessons/:lessonId - Update lesson
// ══════════════════════════════════════════════
router.put('/:lessonId', authorize('ADMIN', 'TEACHER'), async (req: AuthRequest, res: Response) => {
  try {
    const lessonId = parseInt(req.params.lessonId);
    const { topic, homework, status } = req.body;

    const lesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        topic: topic !== undefined ? topic : undefined,
        homework: homework !== undefined ? homework : undefined,
        status: status !== undefined ? status : undefined,
      }
    });

    sendSuccess(res, lesson, 'Dars yangilandi!');
  } catch (err) {
    console.error('updateLesson error:', err);
    sendError(res, 'Darsni yangilashda xato', 500);
  }
});

// ══════════════════════════════════════════════
// DELETE /lessons/:lessonId - Delete lesson
// ══════════════════════════════════════════════
router.delete('/:lessonId', authorize('ADMIN', 'TEACHER'), async (req: AuthRequest, res: Response) => {
  try {
    const lessonId = parseInt(req.params.lessonId);
    await prisma.lesson.delete({ where: { id: lessonId } });
    sendSuccess(res, null, 'Dars o\'chirildi!');
  } catch (err) {
    console.error('deleteLesson error:', err);
    sendError(res, 'Darsni o\'chirishda xato', 500);
  }
});

// ══════════════════════════════════════════════
// Nested routes for lesson materials
// ══════════════════════════════════════════════
router.use('/:lessonId/materials', lessonMaterialRoutes);

export default router;
