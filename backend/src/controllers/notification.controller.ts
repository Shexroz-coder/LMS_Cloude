import prisma from '../lib/prisma';
import { Response } from 'express';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';


export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { limit = '50', unreadOnly } = req.query as Record<string, string>;
    const where: Record<string, unknown> = { userId: req.user!.id };
    if (unreadOnly === 'true') where.isRead = false;
    const notifications = await prisma.notification.findMany({
      where, orderBy: { createdAt: 'desc' }, take: parseInt(limit)
    });
    const unreadCount = await prisma.notification.count({ where: { userId: req.user!.id, isRead: false } });
    sendSuccess(res, { notifications, unreadCount });
  } catch (err) {
    console.error('getNotifications error:', err);
    sendError(res, 'Bildirishnomalarni olishda xato.', 500);
  }
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await prisma.notification.update({ where: { id, userId: req.user!.id }, data: { isRead: true } });
    sendSuccess(res, null, 'O\'qildi deb belgilandi.');
  } catch (err) {
    sendError(res, 'Xato.', 500);
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user!.id, isRead: false }, data: { isRead: true } });
    sendSuccess(res, null, 'Hammasi o\'qildi deb belgilandi.');
  } catch (err) {
    sendError(res, 'Xato.', 500);
  }
};
