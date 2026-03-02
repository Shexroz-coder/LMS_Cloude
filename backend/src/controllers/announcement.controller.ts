import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';

const prisma = new PrismaClient();

export const getAnnouncements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { limit = '50', targetRole } = req.query as Record<string, string>;
    const where: Record<string, unknown> = {};
    if (targetRole) where.targetRoles = { hasSome: [targetRole] };
    // Non-admin faqat o'ziga mos yoki hammaga mo'ljallangan e'lonlarni ko'radi
    if (req.user?.role !== 'ADMIN') {
      where.OR = [
        { targetRoles: { isEmpty: true } },
        { targetRoles: { hasSome: [req.user?.role] } }
      ];
    }
    const announcements = await prisma.announcement.findMany({
      where,
      include: { creator: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    });
    sendSuccess(res, announcements);
  } catch (err) {
    console.error('getAnnouncements error:', err);
    sendError(res, 'E\'lonlarni olishda xato.', 500);
  }
};

export const createAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, body, targetRoles } = req.body;
    if (!title || !body) { sendError(res, 'Sarlavha va matn kiritilishi shart.', 400); return; }
    const ann = await prisma.announcement.create({
      data: { 
        title, 
        body, 
        targetRoles: targetRoles || [],
        createdBy: req.user!.id 
      },
      include: { creator: { select: { fullName: true } } }
    });
    sendSuccess(res, ann, 'E\'lon yaratildi!', 201);
  } catch (err) {
    console.error('createAnnouncement error:', err);
    sendError(res, 'E\'lon yaratishda xato.', 500);
  }
};

export const updateAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { title, body, targetRoles } = req.body;
    const ann = await prisma.announcement.update({
      where: { id },
      data: { 
        ...(title && { title }), 
        ...(body && { body }), 
        ...(targetRoles && { targetRoles })
      },
      include: { creator: { select: { fullName: true } } }
    });
    sendSuccess(res, ann, 'E\'lon yangilandi.');
  } catch (err) {
    console.error('updateAnnouncement error:', err);
    sendError(res, 'E\'lonni yangilashda xato.', 500);
  }
};

export const deleteAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await prisma.announcement.delete({ where: { id } });
    sendSuccess(res, null, 'E\'lon o\'chirildi.');
  } catch (err) {
    console.error('deleteAnnouncement error:', err);
    sendError(res, 'E\'lonni o\'chirishda xato.', 500);
  }
};
