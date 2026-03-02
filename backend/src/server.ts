import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import { setupSocketHandlers } from './socket';

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
});

// Kutilmagan xatoliklarni ushlash
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

export { io };
