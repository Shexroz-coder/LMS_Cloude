import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';
import { sendSuccess, sendError, paginate } from '../utils/response.utils';

const prisma = new PrismaClient();

// ── Shared include ─────────────────────────────────
const gradeInclude = {
  student: {
    include: { user: { select: { fullName: true, avatarUrl: true } } }
  },
  lesson: {
    select: {
      id: true, date: true, topic: true,
      group: { select: { id: true, name: true, course: { select: { name: true } } } }
    }
  }
};

// ══════════════════════════════════════════════
// GET /grades — Baholar ro'yxati
// ══════════════════════════════════════════════
export const getGrades = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1', limit = '30',
      studentId, lessonId, groupId, type, month
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    // Ustoz faqat o'z guruhlarini ko'radi
    let allowedGroupIds: number[] | undefined;
    if (req.user?.role === 'TEACHER') {
      const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
      if (teacher) {
        const teacherGroups = await prisma.group.findMany({
          where: { teacherId: teacher.id },
          select: { id: true }
        });
        allowedGroupIds = teacherGroups.map(g => g.id);
      }
    }

    const where: Record<string, unknown> = {};
    if (studentId) where.studentId = parseInt(studentId);
    if (lessonId) where.lessonId = parseInt(lessonId);
    if (type) where.type = type;

    if (month) {
      const start = new Date(month + '-01');
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      where.lesson = { date: { gte: start, lte: end } };
    }

    if (groupId) {
      where.lesson = { ...(where.lesson as object || {}), groupId: parseInt(groupId) };
    } else if (allowedGroupIds) {
      where.lesson = { ...(where.lesson as object || {}), groupId: { in: allowedGroupIds } };
    }

    const [grades, total] = await Promise.all([
      prisma.grade.findMany({
        where,
        include: gradeInclude,
        skip, take: limitNum,
        orderBy: { givenAt: 'desc' }
      }),
      prisma.grade.count({ where })
    ]);

    sendSuccess(res, grades, undefined, 200, paginate(pageNum, limitNum, total));
  } catch (err) {
    console.error('getGrades error:', err);
    sendError(res, 'Baholarni olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// POST /grades — Baho qo'yish
// ══════════════════════════════════════════════
export const createGrade = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId, lessonId, score, type = 'CLASSWORK', comment } = req.body;

    if (!studentId || !lessonId || score === undefined) {
      sendError(res, "O'quvchi, dars va baho kiritilishi shart.", 400);
      return;
    }

    const scoreNum = parseFloat(score);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      sendError(res, 'Baho 0 dan 100 gacha bo\'lishi kerak.', 400);
      return;
    }

    // Ustoz tekshirish
    if (req.user?.role === 'TEACHER') {
      const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
      if (teacher) {
        const lesson = await prisma.lesson.findUnique({
          where: { id: parseInt(lessonId) },
          include: { group: true }
        });
        if (!lesson || lesson.group.teacherId !== teacher.id) {
          sendError(res, 'Bu dars sizning guruhingizda emas.', 403);
          return;
        }
      }
    }

    const grade = await prisma.grade.create({
      data: {
        studentId: parseInt(studentId),
        lessonId: parseInt(lessonId),
        score: scoreNum,
        type: type as 'HOMEWORK' | 'CLASSWORK' | 'EXAM' | 'PROJECT',
        comment,
      },
      include: gradeInclude
    });

    sendSuccess(res, grade, 'Baho muvaffaqiyatli qo\'yildi!', 201);
  } catch (err) {
    console.error('createGrade error:', err);
    sendError(res, 'Baho qo\'yishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// POST /grades/bulk — Ko'p o'quvchiga bir vaqtda baho
// ══════════════════════════════════════════════
export const createBulkGrades = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { lessonId, grades, type = 'CLASSWORK' } = req.body;
    // grades: [{studentId, score, comment?}]

    if (!lessonId || !grades || !Array.isArray(grades)) {
      sendError(res, "Dars va baholar ro'yxati kiritilishi shart.", 400);
      return;
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: parseInt(lessonId) },
      include: { group: { select: { teacherId: true, name: true } } }
    });

    if (!lesson) {
      sendError(res, 'Dars topilmadi.', 404);
      return;
    }

    // Ustoz tekshirish
    if (req.user?.role === 'TEACHER') {
      const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
      if (!teacher || lesson.group.teacherId !== teacher.id) {
        sendError(res, 'Bu dars sizning guruhingizda emas.', 403);
        return;
      }
    }

    // Avvalgi baholarni o'chirish (lessonId + type kombinatsiyasi uchun)
    await prisma.grade.deleteMany({
      where: {
        lessonId: parseInt(lessonId),
        type: type as 'HOMEWORK' | 'CLASSWORK' | 'EXAM' | 'PROJECT',
      }
    });

    // Yangi baholar yaratish
    const validGrades = (grades as Array<{ studentId: number; score: number; comment?: string }>)
      .filter(g => g.score !== null && g.score !== undefined && !isNaN(parseFloat(String(g.score))));

    if (validGrades.length === 0) {
      sendSuccess(res, { created: 0 }, 'Hech qanday baho saqlanmadi.');
      return;
    }

    const created = await prisma.grade.createMany({
      data: validGrades.map(g => ({
        lessonId: parseInt(lessonId),
        studentId: parseInt(String(g.studentId)),
        score: parseFloat(String(g.score)),
        type: type as 'HOMEWORK' | 'CLASSWORK' | 'EXAM' | 'PROJECT',
        comment: g.comment,
      }))
    });

    sendSuccess(res, { created: created.count, lessonId: parseInt(lessonId) },
      `${created.count} ta o'quvchiga baho qo'yildi!`, 201);
  } catch (err) {
    console.error('createBulkGrades error:', err);
    sendError(res, 'Baholarni saqlashda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// PUT /grades/:id — Bahoni yangilash
// ══════════════════════════════════════════════
export const updateGrade = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { score, type, comment } = req.body;

    const existing = await prisma.grade.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, 'Baho topilmadi.', 404);
      return;
    }

    if (score !== undefined) {
      const scoreNum = parseFloat(score);
      if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
        sendError(res, 'Baho 0 dan 100 gacha bo\'lishi kerak.', 400);
        return;
      }
    }

    const grade = await prisma.grade.update({
      where: { id },
      data: {
        ...(score !== undefined && { score: parseFloat(score) }),
        ...(type && { type: type as 'HOMEWORK' | 'CLASSWORK' | 'EXAM' | 'PROJECT' }),
        ...(comment !== undefined && { comment }),
      },
      include: gradeInclude
    });

    sendSuccess(res, grade, 'Baho yangilandi.');
  } catch (err) {
    console.error('updateGrade error:', err);
    sendError(res, 'Bahoni yangilashda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// DELETE /grades/:id
// ══════════════════════════════════════════════
export const deleteGrade = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const grade = await prisma.grade.findUnique({ where: { id } });
    if (!grade) {
      sendError(res, 'Baho topilmadi.', 404);
      return;
    }
    await prisma.grade.delete({ where: { id } });
    sendSuccess(res, null, 'Baho o\'chirildi.');
  } catch (err) {
    console.error('deleteGrade error:', err);
    sendError(res, 'Bahoni o\'chirishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /grades/gradebook/:groupId — Guruh baholar daftari
// ══════════════════════════════════════════════
export const getGradebook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.params.groupId);
    const { month } = req.query as { month?: string };

    const startDate = month
      ? new Date(month + '-01')
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

    // Guruh o'quvchilar
    const groupStudents = await prisma.groupStudent.findMany({
      where: { groupId, status: 'ACTIVE' },
      include: {
        student: {
          include: { user: { select: { id: true, fullName: true, avatarUrl: true } } }
        }
      },
      orderBy: { student: { user: { fullName: 'asc' } } }
    });

    // Oylik darslar
    const lessons = await prisma.lesson.findMany({
      where: { groupId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
      select: { id: true, date: true, topic: true }
    });

    // Barcha baholar
    const grades = await prisma.grade.findMany({
      where: {
        lesson: { groupId, date: { gte: startDate, lte: endDate } }
      },
      select: { id: true, studentId: true, lessonId: true, score: true, type: true, comment: true }
    });

    // Davomat ham
    const attendances = await prisma.attendance.findMany({
      where: {
        lesson: { groupId, date: { gte: startDate, lte: endDate } }
      },
      select: { studentId: true, lessonId: true, status: true }
    });

    // Structured response: har bir o'quvchi uchun har bir dars bo'yicha
    const gradebook = groupStudents.map(gs => {
      const student = gs.student;
      const studentGrades = grades.filter(g => g.studentId === student.id);
      const studentAttendances = attendances.filter(a => a.studentId === student.id);

      const lessonData = lessons.map(lesson => {
        const grade = studentGrades.find(g => g.lessonId === lesson.id);
        const attendance = studentAttendances.find(a => a.lessonId === lesson.id);
        return {
          lessonId: lesson.id,
          grade: grade ? { id: grade.id, score: Number(grade.score), type: grade.type, comment: grade.comment } : null,
          attendance: attendance?.status || null
        };
      });

      const validGrades = studentGrades.map(g => Number(g.score)).filter(s => !isNaN(s));
      const avgScore = validGrades.length > 0
        ? Math.round((validGrades.reduce((a, b) => a + b, 0) / validGrades.length) * 10) / 10
        : null;

      const presentCount = studentAttendances.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
      const attendanceRate = lessons.length > 0
        ? Math.round((presentCount / lessons.length) * 100)
        : 0;

      return {
        studentId: student.id,
        fullName: student.user.fullName,
        avatarUrl: student.user.avatarUrl,
        lessons: lessonData,
        avgScore,
        attendanceRate,
        totalGrades: validGrades.length,
      };
    });

    sendSuccess(res, {
      gradebook,
      lessons,
      period: { start: startDate, end: endDate, month: startDate.toISOString().slice(0, 7) }
    });
  } catch (err) {
    console.error('getGradebook error:', err);
    sendError(res, 'Baholar daftarini olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /grades/student/:studentId — O'quvchi baholar tarixi
// ══════════════════════════════════════════════
export const getStudentGrades = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.studentId);
    const { groupId, month, type } = req.query as Record<string, string>;

    const where: Record<string, unknown> = { studentId };
    if (type) where.type = type;

    if (month) {
      const start = new Date(month + '-01');
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      where.lesson = { date: { gte: start, lte: end } };
    }

    if (groupId) {
      where.lesson = { ...(where.lesson as object || {}), groupId: parseInt(groupId) };
    }

    const grades = await prisma.grade.findMany({
      where,
      include: {
        lesson: {
          select: {
            id: true, date: true, topic: true,
            group: { select: { id: true, name: true, course: { select: { name: true } } } }
          }
        }
      },
      orderBy: { givenAt: 'desc' },
      take: 100
    });

    // Statistika
    const scores = grades.map(g => Number(g.score));
    const avgScore = scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : 0;

    const byType = grades.reduce<Record<string, { count: number; avg: number; scores: number[] }>>((acc, g) => {
      const t = g.type;
      if (!acc[t]) acc[t] = { count: 0, avg: 0, scores: [] };
      acc[t].scores.push(Number(g.score));
      acc[t].count++;
      return acc;
    }, {});

    Object.keys(byType).forEach(t => {
      const { scores: s } = byType[t];
      byType[t].avg = Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10;
    });

    // Eng yaxshi va eng yomon
    const best = grades.reduce<typeof grades[0] | null>((a, b) =>
      !a || Number(b.score) > Number(a.score) ? b : a, null);
    const worst = grades.reduce<typeof grades[0] | null>((a, b) =>
      !a || Number(b.score) < Number(a.score) ? b : a, null);

    sendSuccess(res, {
      grades,
      stats: {
        totalGrades: grades.length,
        avgScore,
        byType,
        bestScore: best ? { score: Number(best.score), topic: best.lesson.topic, type: best.type } : null,
        worstScore: worst ? { score: Number(worst.score), topic: worst.lesson.topic, type: worst.type } : null,
      }
    });
  } catch (err) {
    console.error('getStudentGrades error:', err);
    sendError(res, 'O\'quvchi baholarini olishda xato.', 500);
  }
};

// ══════════════════════════════════════════════
// GET /grades/stats — Guruh baholar statistikasi
// ══════════════════════════════════════════════
export const getGradeStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupId, month } = req.query as Record<string, string>;

    const where: Record<string, unknown> = {};
    if (groupId) {
      where.lesson = { groupId: parseInt(groupId) };
    }
    if (month) {
      const start = new Date(month + '-01');
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      where.lesson = { ...(where.lesson as object || {}), date: { gte: start, lte: end } };
    }

    const grades = await prisma.grade.findMany({
      where,
      select: { score: true, type: true }
    });

    if (grades.length === 0) {
      sendSuccess(res, { total: 0, avgScore: 0, distribution: [], byType: {} });
      return;
    }

    const scores = grades.map(g => Number(g.score));
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Taqsimot: 0-40, 41-60, 61-75, 76-90, 91-100
    const distribution = [
      { range: '0–40', label: 'Qoniqarsiz', count: scores.filter(s => s <= 40).length, color: '#ef4444' },
      { range: '41–60', label: 'Qoniqarli', count: scores.filter(s => s > 40 && s <= 60).length, color: '#f97316' },
      { range: '61–75', label: 'O\'rta', count: scores.filter(s => s > 60 && s <= 75).length, color: '#eab308' },
      { range: '76–90', label: 'Yaxshi', count: scores.filter(s => s > 75 && s <= 90).length, color: '#22c55e' },
      { range: '91–100', label: 'A\'lo', count: scores.filter(s => s > 90).length, color: '#6366f1' },
    ];

    // Tur bo'yicha
    const byType: Record<string, { count: number; avg: number }> = {};
    ['CLASSWORK', 'HOMEWORK', 'EXAM', 'PROJECT'].forEach(t => {
      const typeGrades = grades.filter(g => g.type === t);
      if (typeGrades.length > 0) {
        const typeScores = typeGrades.map(g => Number(g.score));
        byType[t] = {
          count: typeGrades.length,
          avg: Math.round((typeScores.reduce((a, b) => a + b, 0) / typeGrades.length) * 10) / 10
        };
      }
    });

    sendSuccess(res, {
      total: grades.length,
      avgScore: Math.round(avg * 10) / 10,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
      distribution,
      byType
    });
  } catch (err) {
    console.error('getGradeStats error:', err);
    sendError(res, 'Statistikani olishda xato.', 500);
  }
};
