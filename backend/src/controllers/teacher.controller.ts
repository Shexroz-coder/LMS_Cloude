import prisma from '../lib/prisma';
import { Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { AuthRequest } from '../types';
import { hashPassword } from '../utils/password.utils';
import { sendSuccess, sendError, paginate } from '../utils/response.utils';


const teacherInclude = {
  user: {
    select: { id: true, fullName: true, phone: true, email: true, avatarUrl: true, isActive: true, createdAt: true }
  },
  _count: {
    select: { groups: true }
  }
};

// ══════════════════════════════════════════════
// GET /teachers
// ══════════════════════════════════════════════
export const getTeachers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', search = '' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {
      user: { isActive: true, ...(search && { OR: [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } }
      ]}) }
    };

    const [teachers, total] = await Promise.all([
      prisma.teacher.findMany({ where, include: teacherInclude, skip, take: limitNum, orderBy: { user: { fullName: 'asc' } } }),
      prisma.teacher.count({ where })
    ]);

    sendSuccess(res, teachers, undefined, 200, paginate(pageNum, limitNum, total));
  } catch (err) {
    console.error('getTeachers error:', err);
    sendError(res, 'Ustozlarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /teachers/:id
// ══════════════════════════════════════════════
export const getTeacherById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: {
        ...teacherInclude,
        groups: {
          where: { status: 'ACTIVE' },
          include: {
            course: { select: { name: true } },
            _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } }
          }
        },
        salaries: { take: 6, orderBy: { month: 'desc' } }
      }
    });

    if (!teacher) {
      sendError(res, 'Ustoz topilmadi.', 404);
      return;
    }

    sendSuccess(res, teacher);
  } catch (err) {
    console.error('getTeacherById error:', err);
    sendError(res, 'Ustozni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// POST /teachers
// ══════════════════════════════════════════════
export const createTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      fullName, phone, email, password = 'teacher123',
      salaryType = 'PERCENTAGE_FROM_PAYMENT', salaryValue = 20,
      language = 'uz', specialization, bio
    } = req.body;

    if (!fullName || !phone) {
      sendError(res, "To'liq ism va telefon kiritilishi shart.", 400);
      return;
    }

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      sendError(res, 'Bu telefon raqam allaqachon ro\'yxatdan o\'tgan.', 409);
      return;
    }

    const passwordHash = await hashPassword(password);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName, phone, email, passwordHash,
          role: Role.TEACHER,
          language: language as 'uz' | 'ru',
        }
      });

      return tx.teacher.create({
        data: {
          userId: user.id,
          salaryType: salaryType as 'PERCENTAGE_FROM_PAYMENT' | 'PER_LESSON_HOUR',
          salaryValue: parseFloat(salaryValue),
          specialization,
          bio,
        },
        include: teacherInclude
      });
    });

    sendSuccess(res, result, 'Ustoz muvaffaqiyatli qo\'shildi!', 201);
  } catch (err) {
    console.error('createTeacher error:', err);
    sendError(res, 'Ustoz qo\'shishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// PUT /teachers/:id
// ══════════════════════════════════════════════
export const updateTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { fullName, phone, email, isActive, salaryType, salaryValue, specialization, bio, language } = req.body;

    const teacher = await prisma.teacher.findUnique({ where: { id }, include: { user: true } });
    if (!teacher) {
      sendError(res, 'Ustoz topilmadi.', 404);
      return;
    }

    if (phone && phone !== teacher.user.phone) {
      const existing = await prisma.user.findUnique({ where: { phone } });
      if (existing) {
        sendError(res, 'Bu telefon raqam boshqa foydalanuvchida bor.', 409);
        return;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: teacher.userId },
        data: {
          ...(fullName && { fullName }),
          ...(phone && { phone }),
          ...(email !== undefined && { email }),
          ...(isActive !== undefined && { isActive }),
          ...(language && { language: language as 'uz' | 'ru' }),
        }
      });

      return tx.teacher.update({
        where: { id },
        data: {
          ...(salaryType && { salaryType: salaryType as 'PERCENTAGE_FROM_PAYMENT' | 'PER_LESSON_HOUR' }),
          ...(salaryValue !== undefined && { salaryValue: parseFloat(salaryValue) }),
          ...(specialization !== undefined && { specialization }),
          ...(bio !== undefined && { bio }),
        },
        include: teacherInclude
      });
    });

    sendSuccess(res, result, 'Ustoz yangilandi.');
  } catch (err) {
    console.error('updateTeacher error:', err);
    sendError(res, 'Ustozni yangilashda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// DELETE /teachers/:id (soft delete)
// ══════════════════════════════════════════════
export const deleteTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    const teacher = await prisma.teacher.findUnique({ where: { id } });
    if (!teacher) {
      sendError(res, 'Ustoz topilmadi.', 404);
      return;
    }

    await prisma.user.update({
      where: { id: teacher.userId },
      data: { isActive: false }
    });

    sendSuccess(res, null, 'Ustoz o\'chirildi.');
  } catch (err) {
    console.error('deleteTeacher error:', err);
    sendError(res, 'Ustozni o\'chirishda xato.', 500);
  }
};
