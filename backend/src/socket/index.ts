import prisma from '../lib/prisma';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt.utils';


// Online foydalanuvchilar: userId → Set<socketId>
const onlineUsers = new Map<number, Set<string>>();

function addOnline(userId: number, socketId: string) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId)!.add(socketId);
}

function removeOnline(userId: number, socketId: string) {
  onlineUsers.get(userId)?.delete(socketId);
  if (onlineUsers.get(userId)?.size === 0) onlineUsers.delete(userId);
}

export const setupSocketHandlers = (io: Server): void => {

  // ── Auth middleware ───────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Token kerak'));
    try {
      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Token noto\'g\'ri'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const userId: number = socket.data.user.userId;
    addOnline(userId, socket.id);

    // Online status broadcast
    io.emit('user_online', userId);
    console.log(`✅ Socket ulandi: userId=${userId}`);

    // ── Uzilish ─────────────────────────────────────────
    socket.on('disconnect', () => {
      removeOnline(userId, socket.id);
      if (!onlineUsers.has(userId)) {
        io.emit('user_offline', userId);
      }
      console.log(`❌ Socket uzildi: userId=${userId}`);
    });
  });
};

// ── Tashqi funksiyalar ─────────────────────────────────
export const sendNotificationToUser = (
  io: Server,
  userId: number,
  notification: object
): void => {
  const sockets = onlineUsers.get(userId);
  if (sockets) {
    sockets.forEach((sid) => io.to(sid).emit('new_notification', notification));
  }
};

export const getOnlineUsers = (): number[] => Array.from(onlineUsers.keys());
export const isUserOnline = (userId: number): boolean => onlineUsers.has(userId);
