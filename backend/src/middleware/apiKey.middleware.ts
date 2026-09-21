/**
 * API-KALIT AUTENTIFIKATSIYASI (AI agent uchun)
 *
 * Agent so'rovlari JWT emas, X-API-Key sarlavhasi bilan autentifikatsiya
 * qilinadi. Kalit .env dagi AGENT_API_KEY bilan solishtiriladi.
 *
 * Muvaffaqiyatli bo'lsa — req.user ADMIN sifatida o'rnatiladi (yozish
 * amallari uchun receivedBy/createdBy kerak).
 */
import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { sendError } from '../utils/response.utils';
import { AuthRequest } from '../types';

let cachedAdminId: number | null = null;

export async function apiKeyAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const key = req.headers['x-api-key'] as string | undefined;
    const expected = process.env.AGENT_API_KEY;

    if (!expected) {
      sendError(res, 'Agent API sozlanmagan (AGENT_API_KEY yo\'q).', 503);
      return;
    }
    if (!key || key !== expected) {
      sendError(res, 'Noto\'g\'ri yoki yo\'q API kalit.', 401);
      return;
    }

    // Agent nomidan ish yuritish uchun admin ID
    if (cachedAdminId === null) {
      const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
      cachedAdminId = admin?.id ?? 0;
    }

    req.user = { id: cachedAdminId, role: 'ADMIN' as any, phone: 'ai-agent' };
    next();
  } catch (err) {
    console.error('apiKeyAuth error:', err);
    sendError(res, 'Autentifikatsiya xatosi.', 500);
  }
}
