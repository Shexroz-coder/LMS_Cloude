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
import bot from '../telegram/bot';
import { escapeHtml } from '../telegram/utils/format';
import { normalizePhone, phoneVariants } from '../utils/phone.utils';

const DAY_NAMES_UZ = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const TIME_LABELS: Record<string, string> = {
  morning:   '🌅 Ertalab (9:00–12:00)',
  afternoon: '☀️ Kunduz (12:00–17:00)',
  evening:   '🌆 Kechqurun (17:00–21:00)',
};


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

    // Foydalanuvchini topish — turli formatlarda saqlangan raqamlarni ham hisobga olish
    const user = await prisma.user.findFirst({
      where: { phone: { in: phoneVariants(phone) } },
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

    // Eski formatdagi raqamni asta-sekin standartlashtirish (+998XXXXXXXXX)
    const normalized = normalizePhone(user.phone);
    if (normalized !== user.phone) {
      const conflict = await prisma.user.findUnique({ where: { phone: normalized } });
      if (!conflict) {
        await prisma.user.update({ where: { id: user.id }, data: { phone: normalized } });
        user.phone = normalized;
      }
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

// =====================
// POST /auth/register — Ochiq ro'yxatdan o'tish (autentifikatsiya talab etilmaydi)
// =====================
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      fullName,
      phone,
      password,
      preferredDays = [],    // [1,3,5] — Du,Cho,Ju
      preferredTime = '',    // 'morning' | 'afternoon' | 'evening'
      interestedCourseId,
    } = req.body;

    // Majburiy maydonlar
    if (!fullName || !phone || !password) {
      sendError(res, 'Ism, telefon va parol majburiy.', 400);
      return;
    }
    if (password.length < 6) {
      sendError(res, 'Parol kamida 6 belgidan iborat bo\'lishi kerak.', 400);
      return;
    }

    // Telefon raqamni standart formatga keltirish: +998XXXXXXXXX
    const normalizedPhone = normalizePhone(phone);

    // Telefon unikalligi
    const existing = await prisma.user.findFirst({ where: { phone: { in: phoneVariants(normalizedPhone) } } });
    if (existing) {
      sendError(res, 'Bu telefon raqam allaqachon ro\'yxatdan o\'tgan.', 409);
      return;
    }

    const passwordHash = await hashPassword(password);

    // Tranzaksiya: User + Student
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName,
          phone: normalizedPhone,
          passwordHash,
          role: 'STUDENT',
          isActive: true,
        },
      });

      const student = await tx.student.create({
        data: {
          userId: user.id,
          status: 'LEAD',
          // @ts-ignore — yangi maydonlar: Prisma migrate deploy dan keyin ishlaydi
          preferredDays: Array.isArray(preferredDays) ? preferredDays.map(Number) : [],
          preferredTime: preferredTime || null,
          interestedCourseId: interestedCourseId ? parseInt(interestedCourseId) : null,
        } as any,
      });

      return { user, student };
    });

    // ── Adminga Telegram xabar ──────────────────────
    setImmediate(async () => {
      try {
        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN', telegramChatId: { not: null }, isActive: true },
          select: { telegramChatId: true },
        });

        let courseName = '';
        if (interestedCourseId) {
          const course = await prisma.course.findUnique({
            where: { id: parseInt(interestedCourseId) },
            select: { name: true },
          });
          courseName = course?.name || '';
        }

        const days = (Array.isArray(preferredDays) ? preferredDays : [])
          .map((d: number) => DAY_NAMES_UZ[d] || d)
          .join(', ');

        const msg =
          `🆕 <b>Yangi ariza!</b>\n\n` +
          `👤 <b>${escapeHtml(fullName)}</b>\n` +
          `📞 ${escapeHtml(phone)}\n` +
          (courseName ? `📚 Kurs: ${escapeHtml(courseName)}\n` : '') +
          (days ? `📅 Qulay kunlar: ${days}\n` : '') +
          (preferredTime ? `🕐 Vaqt: ${TIME_LABELS[preferredTime] || preferredTime}\n` : '') +
          `\n<i>O'quvchilar bo'limida LEAD holatda ko'ring.</i>`;

        for (const admin of admins) {
          if (admin.telegramChatId) {
            await bot.api.sendMessage(admin.telegramChatId, msg, { parse_mode: 'HTML' }).catch(() => {});
          }
        }
      } catch (e) {
        console.error('Register admin notify error:', e);
      }
    });

    // ── Tokenlar yaratish (avtomatik login) ─────────
    const payload = { userId: result.user.id, role: result.user.role, phone: result.user.phone };
    const accessToken  = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);
    await prisma.refreshToken.create({
      data: { userId: result.user.id, token: refreshToken, expiresAt },
    });

    sendSuccess(res, {
      accessToken,
      refreshToken,
      user: {
        id:        result.user.id,
        fullName:  result.user.fullName,
        phone:     result.user.phone,
        role:      result.user.role,
        language:  result.user.language,
        avatarUrl: result.user.avatarUrl,
        student:   { id: result.student.id, coinBalance: 0 },
      },
    }, 'Muvaffaqiyatli ro\'yxatdan o\'tdingiz! Tez orada siz bilan bog\'lanamiz.', 201);

  } catch (err) {
    console.error('Register error:', err);
    sendError(res, 'Ro\'yxatdan o\'tishda xato.', 500);
  }
};
