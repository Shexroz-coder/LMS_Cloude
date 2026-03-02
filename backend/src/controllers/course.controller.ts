import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';

const prisma = new PrismaClient();

// ══════════════════════════════════════════════
// GET /courses
// ══════════════════════════════════════════════
export const getCourses = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        _count: { select: { groups: true } }
      },
      orderBy: { name: 'asc' }
    });
    sendSuccess(res, courses);
  } catch (err) {
    console.error('getCourses error:', err);
    sendError(res, 'Kurslarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// POST /courses
// ══════════════════════════════════════════════
export const createCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, monthlyPrice, durationMonths } = req.body;

    if (!name || !monthlyPrice) {
      sendError(res, 'Kurs nomi va oylik narxi kiritilishi shart.', 400);
      return;
    }

    const existing = await prisma.course.findFirst({ where: { name } });
    if (existing) {
      sendError(res, 'Bu nomli kurs allaqachon mavjud.', 409);
      return;
    }

    const course = await prisma.course.create({
      data: {
        name,
        description,
        monthlyPrice: parseFloat(monthlyPrice),
        durationMonths: durationMonths ? parseInt(durationMonths) : undefined,
      }
    });

    sendSuccess(res, course, 'Kurs yaratildi!', 201);
  } catch (err) {
    console.error('createCourse error:', err);
    sendError(res, 'Kurs yaratishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// PUT /courses/:id
// ══════════════════════════════════════════════
export const updateCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, monthlyPrice, durationMonths } = req.body;

    const course = await prisma.course.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(monthlyPrice && { monthlyPrice: parseFloat(monthlyPrice) }),
        ...(durationMonths !== undefined && { durationMonths: durationMonths ? parseInt(durationMonths) : null }),
      }
    });

    sendSuccess(res, course, 'Kurs yangilandi.');
  } catch (err) {
    console.error('updateCourse error:', err);
    sendError(res, 'Kursni yangilashda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// DELETE /courses/:id
// ══════════════════════════════════════════════
export const deleteCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    const groupCount = await prisma.group.count({ where: { courseId: id, status: 'ACTIVE' } });
    if (groupCount > 0) {
      sendError(res, `Bu kursda ${groupCount} ta faol guruh bor. Avval guruhlarni yoping.`, 400);
      return;
    }

    await prisma.course.delete({ where: { id } });
    sendSuccess(res, null, 'Kurs o\'chirildi.');
  } catch (err) {
    console.error('deleteCourse error:', err);
    sendError(res, 'Kursni o\'chirishda xato.', 500);
  }
};
