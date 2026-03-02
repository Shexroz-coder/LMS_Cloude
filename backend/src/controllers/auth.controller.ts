import prisma from '../lib/prisma';
import { Request, Response } from 'express';
import { comparePassword, hashPassword } from '../utils/password.utils';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  REFRESH_TOKEN_DAYS,
} from '../utils/jwt.utils';
import { sendSuccess, sendError } from '../utils/response.utils';
import { AuthRequest } from '../types';


// =====================
// POST /auth/login
// =====================
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      sendError(res, 'Telefon raqam va parol kiritilishi shart.', 400);
      return;
    }

    // Foydalanuvchini topish
    const user = await prisma.user.findUnique({
      where: { phone },
      include: {
        student: {
          select: { id: true, coinBalance: true }
        },
        teacher: {
          select: { id: true, specialization: true }
        }
      }
    });

    if (!user || !user.isActive) {
      sendError(res, 'Telefon raqam yoki parol noto\'g\'ri.', 401);
      return;
    }

    // Parolni tekshirish
    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      sendError(res, 'Telefon raqam yoki parol noto\'g\'ri.', 401);
      return;
    }

    // Tokenlar yaratish
    const payload = { userId: user.id, role: user.role, phone: user.phone };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Refresh tokenni DB ga saqlash
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

    await prisma.refreshToken.create({
      data: { userId: user.id, token: refreshToken, expiresAt }
    });

    // Javob
    sendSuccess(res, {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        language: user.language,
        student: user.student,
        teacher: user.teacher,
      }
    }, 'Muvaffaqiyatli kirdingiz!');

  } catch (err) {
    console.error('Login error:', err);
    sendError(res, 'Server xatosi.', 500);
  }
};

// =====================
// POST /auth/refresh
// =====================
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      sendError(res, 'Refresh token talab qilinadi.', 400);
      return;
    }

    // Tokenni tekshirish
    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      sendError(res, 'Refresh token muddati tugagan. Qayta kiring.', 401);
      return;
    }

    // DB da tekshirish
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token }
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      sendError(res, 'Refresh token topilmadi yoki muddati tugagan.', 401);
      return;
    }

    // Yangi tokenlar
    const newPayload = { userId: payload.userId, role: payload.role, phone: payload.phone };
    const newAccessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    // Eski tokenni yangilash
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

    await prisma.refreshToken.update({
      where: { token },
      data: { token: newRefreshToken, expiresAt }
    });

    sendSuccess(res, { accessToken: newAccessToken, refreshToken: newRefreshToken });

  } catch (err) {
    console.error('Refresh error:', err);
    sendError(res, 'Server xatosi.', 500);
  }
};

// =====================
// POST /auth/logout
// =====================
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } });
    }

    sendSuccess(res, null, 'Muvaffaqiyatli chiqdingiz.');
  } catch {
    sendError(res, 'Server xatosi.', 500);
  }
};

// =====================
// GET /auth/me
// =====================
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        role: true,
        avatarUrl: true,
        language: true,
        isActive: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            coinBalance: true,
            discountType: true,
            discountValue: true,
            parent: { select: { id: true, fullName: true, phone: true } }
          }
        },
        teacher: {
          select: { id: true, specialization: true, salaryType: true }
        }
      }
    });

    if (!user) {
      sendError(res, 'Foydalanuvchi topilmadi.', 404);
      return;
    }

    // Ota-ona uchun farzandlar ro'yxatini qo'shish
    if (req.user!.role === 'PARENT') {
      const children = await prisma.student.findMany({
        where: { parentId: req.user!.id },
        select: {
          id: true,
          coinBalance: true,
          discountType: true,
          discountValue: true,
          status: true,
          user: { select: { id: true, fullName: true, phone: true } },
        },
        orderBy: { id: 'asc' },
      });
      sendSuccess(res, { ...user, children });
      return;
    }

    sendSuccess(res, user);
  } catch {
    sendError(res, 'Server xatosi.', 500);
  }
};

// =====================
// PUT /auth/change-password
// =====================
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      sendError(res, 'Joriy va yangi parol kiritilishi shart.', 400);
      return;
    }

    if (newPassword.length < 6) {
      sendError(res, 'Yangi parol kamida 6 belgidan iborat bo\'lishi kerak.', 400);
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

    if (!user) {
      sendError(res, 'Foydalanuvchi topilmadi.', 404);
      return;
    }

    const isValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isValid) {
      sendError(res, 'Joriy parol noto\'g\'ri.', 400);
      return;
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash: newHash }
    });

    // Barcha refresh tokenlarni o'chirish (boshqa qurilmalardan chiqish)
    await prisma.refreshToken.deleteMany({ where: { userId: req.user!.id } });

    sendSuccess(res, null, 'Parol muvaffaqiyatli o\'zgartirildi.');
  } catch {
    sendError(res, 'Server xatosi.', 500);
  }
};

// PUT /auth/profile
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { fullName, email, language } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(fullName && { fullName }),
        ...(email !== undefined && { email }),
        ...(language && { language }),
      },
      select: { id: true, fullName: true, phone: true, email: true, role: true, language: true, avatarUrl: true }
    });
    sendSuccess(res, updated, 'Profil yangilandi.');
  } catch {
    sendError(res, 'Profilni yangilashda xato.', 500);
  }
};
