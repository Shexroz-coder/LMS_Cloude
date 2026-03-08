/**
 * Telegram bot — ishga tushirish va to'xtatish
 */
import bot from './bot';
import { registerHandlers } from './handlers';

let isRunning = false;

export async function startTelegramBot() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log('⚠️  TELEGRAM_BOT_TOKEN topilmadi — bot ishga tushmaydi.');
    return;
  }

  try {
    // Handlerlarni register qilish
    registerHandlers();

    // Long polling bilan ishga tushirish
    await bot.start({
      onStart: (botInfo: { username: string; id: number }) => {
        isRunning = true;
        console.log(`
  ╔══════════════════════════════════════════╗
  ║   🤖 Telegram Bot ishga tushdi!          ║
  ║   📛 @${botInfo.username}
  ║   🆔 ${botInfo.id}
  ╚══════════════════════════════════════════╝
        `);
      },
    });
  } catch (err) {
    console.error('❌ Telegram bot ishga tushirishda xato:', err);
  }
}

export async function stopTelegramBot() {
  if (isRunning) {
    await bot.stop();
    isRunning = false;
    console.log('🛑 Telegram bot to\'xtatildi.');
  }
}

export { bot };
