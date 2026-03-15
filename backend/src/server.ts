import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import { setupSocketHandlers } from './socket';
import { setIO } from './services/io.service';
import { startTelegramBot, stopTelegramBot } from './telegram';
import { startMonthlyDebtCron } from './cron/monthly-debt.cron';
import { startLessonReminderCron } from './cron/lesson-reminder.cron';

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);

// Socket.io sozlash
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// IO singletonni sozlash (controller'lardan foydalanish uchun)
setIO(io);
setupSocketHandlers(io);

// Server ishga tushirish
httpServer.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   🤖 Robotic Edu LMS — Backend API       ║
  ║   🟢 Server port: ${PORT}                  ║
  ║   🌐 URL: http://localhost:${PORT}/api/v1  ║
  ║   📊 Prisma Studio: npx prisma studio    ║
  ╚══════════════════════════════════════════╝
  `);

  // Telegram botni ishga tushirish
  startTelegramBot().catch(err => {
    console.error('❌ Telegram bot ishga tushirishda xato:', err);
  });

  // Cron job'larni ishga tushirish
  startMonthlyDebtCron();
  startLessonReminderCron();
});

// Kutilmagan xatoliklarni ushlash
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown — Telegram botni to'xtatish
process.on('SIGINT', async () => {
  console.log('\n🛑 Server to\'xtatilmoqda...');
  await stopTelegramBot();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await stopTelegramBot();
  process.exit(0);
});

export { io };
