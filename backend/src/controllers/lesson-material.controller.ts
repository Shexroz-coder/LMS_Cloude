import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';

const prisma = new PrismaClient();

export const getLessonMaterials = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lessonId = parseInt(req.params.lessonId);
    const materials = await prisma.$queryRaw`
      SELECT id, lesson_id as "lessonId", type, title, url, added_by as "addedBy", created_at as "createdAt"
      FROM lesson_materials
      WHERE lesson_id = ${lessonId}
      ORDER BY created_at DESC
    `;
    sendSuccess(res, materials);
  } catch (err) {
    sendError(res, 'Materiallarni olishda xato', 500);
  }
};

export const addLessonMaterial = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lessonId = parseInt(req.params.lessonId);
    const { type, title, url } = req.body;
    if (!type || !title || !url) { sendError(res, 'Tur, sarlavha va havola kiritilishi shart', 400); return; }
    
    const material = await prisma.$queryRaw`
      INSERT INTO lesson_materials (lesson_id, type, title, url, added_by, created_at)
      VALUES (${lessonId}, ${type}, ${title}, ${url}, ${req.user?.id || null}, CURRENT_TIMESTAMP)
      RETURNING id, lesson_id as "lessonId", type, title, url, added_by as "addedBy", created_at as "createdAt"
    `;
    sendSuccess(res, material, 'Material qo\'shildi!', 201);
  } catch (err) {
    sendError(res, 'Material qo\'shishda xato', 500);
  }
};

export const deleteLessonMaterial = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await prisma.$executeRaw`DELETE FROM lesson_materials WHERE id = ${id}`;
    sendSuccess(res, null, 'Material o\'chirildi');
  } catch (err) {
    sendError(res, 'Materialni o\'chirishda xato', 500);
  }
};
