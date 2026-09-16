import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.utils';
import { sendError } from '../utils/response.utils';
import { AuthRequest } from '../types';

// Rol turlari (FOUNDER yangi qo'shildi — Prisma client eskirgan bo'lsa ham ishlaydi)
export type AppRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT' | 'FOUNDER';

// JWT token tekshirish
export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendError(res, 'Token topilmadi. Tizimga kiring.', 401);
      return;
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);

    req.user = {
      id: payload.userId,
      role: payload.role,
      phone: payload.phone,
    };

    next();
  } catch {
    sendError(res, 'Token muddati tugagan yoki noto\'g\'ri. Qayta kiring.', 401);
  }
};

// Rol tekshirish
export const authorize = (...roles: AppRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Autentifikatsiya talab qilinadi.', 401);
      return;
    }

    if (!roles.includes(req.user.role as AppRole)) {
      sendError(res, 'Bu amalni bajarish uchun ruxsatingiz yo\'q.', 403);
      return;
    }

    next();
  };
};
