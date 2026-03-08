import { Bot, session, Context, SessionFlavor } from 'grammy';

// ── Session ma'lumotlari ──────────────────────────
/** Eslab qolingan profil */
export interface LinkedAccount {
  phone: string;
  fullName: string;
  role: string;
  linkedAt: string; // ISO date
}

export interface SessionData {
  /** Ro'yxatdan o'tish bosqichi */
  step: 'idle' | 'waiting_phone' | 'waiting_otp';
  /** Telefon raqam (OTP tekshirish uchun) */
  phone?: string;
  /** Ota-ona tanlagan bola ID */
  selectedChildId?: number;
  /** Eslab qolingan profillar (logout qilinganda saqlanadi) */
  linkedAccounts?: LinkedAccount[];
}

export type BotContext = Context & SessionFlavor<SessionData>;

// ── Bot instance ──────────────────────────────────
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN .env da topilmadi!');
}

const bot = new Bot<BotContext>(token);

// ── Session middleware ────────────────────────────
bot.use(
  session({
    initial: (): SessionData => ({
      step: 'idle',
    }),
  })
);

export default bot;
