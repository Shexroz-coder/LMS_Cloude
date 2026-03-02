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

    // Foydalanuvchining barcha chatlariga avtomatik qo'shish
    try {
      const chats = await prisma.chatParticipant.findMany({ where: { userId } });
      chats.forEach((cp) => socket.join(`chat_${cp.chatId}`));
    } catch {}

    // Online status broadcast
    io.emit('user_online', userId);
    console.log(`✅ Socket ulandi: userId=${userId}`);

    // ── Chatga kirish ───────────────────────────────────
    socket.on('join_chat', (chatId: number) => {
      socket.join(`chat_${chatId}`);
    });

    socket.on('leave_chat', (chatId: number) => {
      socket.leave(`chat_${chatId}`);
    });

    // ── Xabar yuborish ──────────────────────────────────
    socket.on('send_message', async (data: {
      chatId: number;
      content?: string;
      type?: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      duration?: number;
      tempId?: string;
    }) => {
      try {
        const participant = await prisma.chatParticipant.findUnique({
          where: { chatId_userId: { chatId: data.chatId, userId } },
        });
        if (!participant) return;

        const msgType = (data.type as 'TEXT' | 'IMAGE' | 'FILE' | 'VOICE') || 'TEXT';

        const message = await prisma.message.create({
          data: {
            chatId: data.chatId,
            senderId: userId,
            content: data.content,
            type: msgType,
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileSize: data.fileSize,
            duration: data.duration,
          },
          include: {
            sender: {
              select: { id: true, fullName: true, role: true, avatarUrl: true },
            },
          },
        });

        // Chat lastMessage yangilash
        const lastMsg =
          msgType === 'TEXT' ? (data.content?.slice(0, 100) || '') :
          msgType === 'IMAGE' ? '🖼 Rasm' :
          msgType === 'VOICE' ? '🎤 Ovozli xabar' :
          `📎 ${data.fileName || 'Fayl'}`;

        await prisma.chat.update({
          where: { id: data.chatId },
          data: { lastMessage: lastMsg, lastMessageAt: new Date() },
        });

        io.to(`chat_${data.chatId}`).emit('new_message', {
          ...message,
          tempId: data.tempId,
        });

        io.to(`chat_${data.chatId}`).emit('chat_updated', {
          chatId: data.chatId,
          lastMessage: lastMsg,
          lastMessageAt: message.createdAt,
        });
      } catch (err) {
        console.error('send_message error:', err);
        socket.emit('message_error', { tempId: data.tempId, error: 'Yuborilmadi' });
      }
    });

    // ── Typing ──────────────────────────────────────────
    socket.on('typing', (data: { chatId: number }) => {
      socket.to(`chat_${data.chatId}`).emit('user_typing', { userId, chatId: data.chatId });
    });

    socket.on('stop_typing', (data: { chatId: number }) => {
      socket.to(`chat_${data.chatId}`).emit('user_stop_typing', { userId, chatId: data.chatId });
    });

    // ── O'qildi ─────────────────────────────────────────
    socket.on('mark_read', async (data: { chatId: number }) => {
      try {
        await prisma.chatParticipant.update({
          where: { chatId_userId: { chatId: data.chatId, userId } },
          data: { lastReadAt: new Date() },
        });
        socket.to(`chat_${data.chatId}`).emit('messages_read', { chatId: data.chatId, userId });
      } catch {}
    });

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
