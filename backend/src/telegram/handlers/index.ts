/**
 * Barcha handlerlarni bot ga register qilish
 */
import bot, { BotContext } from '../bot';
import { handleStart, handlePhone, handleOtp, handleParentChildName, handleParentChildPhone, handleContact } from './start.handler';
import { routeCallback } from './menu.handler';
import { handleLateAttReason, handleTeacherCoinAmount } from './teacher.handler';
import { handleNewPassword } from './account.handler';
import { handleBroadcastSend } from './admin.handler';

export function registerHandlers() {
  // ── /start komandasi ────────────────────────────
  bot.command('start', handleStart);

  // ── Callback query handler (menyu tugmalari) ────
  bot.on('callback_query:data', routeCallback);

  // ── Contact (telefon raqam ulashish) ────────────
  bot.on('message:contact', async (ctx: BotContext) => {
    await handleContact(ctx);
  });

  // ── Text xabarlari (telefon va OTP) ─────────────
  bot.on('message:text', async (ctx: BotContext) => {
    const step = ctx.session.step;

    // Registratsiya jarayonida bo'lsa
    if (step === 'waiting_phone') {
      await handlePhone(ctx);
      return;
    }

    if (step === 'waiting_otp') {
      await handleOtp(ctx);
      return;
    }

    // Ota-ona registratsiya flow
    if (step === 'waiting_parent_child_name') {
      await handleParentChildName(ctx);
      return;
    }

    if (step === 'waiting_parent_child_phone') {
      await handleParentChildPhone(ctx);
      return;
    }

    // Kechikkan davomat sababi
    if (step === 'waiting_late_att_reason') {
      await handleLateAttReason(ctx);
      return;
    }

    // Coin miqdori kiriting
    if (step === 'waiting_coin_amount') {
      await handleTeacherCoinAmount(ctx);
      return;
    }

    // Yangi parol kiriting
    if (step === 'waiting_new_password') {
      await handleNewPassword(ctx);
      return;
    }

    // Admin broadcast xabar matni
    if (step === 'waiting_broadcast_text') {
      await handleBroadcastSend(ctx);
      return;
    }

    // Registratsiyadan o'tgan foydalanuvchi oddiy xabar yozsa
    await ctx.reply(
      '🤖 Menyudan foydalaning!\n\n/start — Asosiy menyu',
      { parse_mode: 'HTML' }
    );
  });

  // ── Xatolik handler ─────────────────────────────
  bot.catch((err: Error) => {
    console.error('❌ Telegram bot xatosi:', err);
  });
}
