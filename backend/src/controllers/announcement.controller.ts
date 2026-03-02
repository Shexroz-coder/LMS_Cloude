import prisma from '../lib/prisma';
import { Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';
import { getIO } from '../services/io.service';
import { sendNotificationToUser } from '../socket';


// ─────────────────────────────────────────────────────────
// Helper: E'lon uchun tegishli foydalanuvchilarga
//         Notification yaratish + socket yuborish
// ─────────────────────────────────────────────────────────
async function notifyTargetUsers(
  title: string,
  body: string,
  targetRoles: string[],
  announcementId: number,
  creatorId: number
): Promise<void> {
  try {
    // targetRoles bo'sh bo'lsa — hammaga (barcha rollarga)
    const whereRole = targetRoles.length > 0
      ? { role: { in: targetRoles as ('ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT')[] } }
      : {};

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        id: { not: creatorId }, // E'lon yaratuvchiga yubormaymiz
        ...whereRole,
      },
      select: { id: true },
    });

    if (users.length === 0) return;

    // Bulk Notification yaratish
    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        title,
        body,
        type: 'ANNOUNCEMENT' as const,
        actionUrl: `/announcements/${announcementId}`,
        isRead: false,
      })),
    });

    // Socket orqali online foydalanuvchilarga real-time yuborish
    const io = getIO();
    if (io) {
      for (const u of users) {
        const notification = {
          title,
          body,
          type: 'ANNOUNCEMENT',
          actionUrl: `/announcements/${announcementId}`,
          isRead: false,
          createdAt: new Date().toISOString(),
        };
        sendNotificationToUser(io, u.id, notification);
      }
    }
  } catch (err) {
    console.error('notifyTargetUsers error:', err);
  }
}

// ─────────────────────────────────────────────────────────
// GET /announcements
// ─────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────
// POST /announcements — E'lon yaratish + notification yuborish
// ─────────────────────────────────────────────────────────
export const createAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, body, targetRoles } = req.body;
    if (!title || !body) { sendError(res, 'Sarlavha va matn kiritilishi shart.', 400); return; }

    const roles: Role[] = Array.isArray(targetRoles) ? (targetRoles as Role[]) : [];

    const ann = await prisma.announcement.create({
      data: {
        title,
        body,
        targetRoles: roles,
        createdBy: req.user!.id
      },
      include: { creator: { select: { fullName: true } } }
    });

    // Background: tegishli foydalanuvchilarga notification yaratish
    // await dan oldin response yuboramiz, keyin background'da ishlaymiz
    sendSuccess(res, ann, 'E\'lon yaratildi!', 201);

    // Async notification yuborish (response'ni bloklama)
    notifyTargetUsers(title, body, roles, ann.id, req.user!.id).catch(console.error);

  } catch (err) {
    console.error('createAnnouncement error:', err);
    sendError(res, 'E\'lon yaratishda xato.', 500);
  }
};

// ─────────────────────────────────────────────────────────
// PUT /announcements/:id
// ─────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────
// DELETE /announcements/:id
// ─────────────────────────────────────────────────────────
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
