/**
 * Barcha handlerlarni bot ga register qilish
 */
import bot, { BotContext } from '../bot';
import { handleStart, handlePhone, handleOtp, handleParentChildName, handleParentChildPhone } from './start.handler';
import { routeCallback } from './menu.handler';
import { handleLateAttReason } from './teacher.handler';
import { handleBroadcastSend } from './admin.handler';

export function registerHandlers() {
  // ── /start komandasi ────────────────────────────
  bot.command('start', handleStart);

  // ── Callback query handler (menyu tugmalari) ────
  bot.on('callback_query:data', routeCallback);

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
