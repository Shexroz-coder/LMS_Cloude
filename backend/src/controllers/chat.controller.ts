import prisma from '../lib/prisma';
import { Response } from 'express';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';
import { getIO } from '../services/io.service';


// ─────────────────────────────────────────────────────────
// Foydalanuvchining barcha chatlari
// ─────────────────────────────────────────────────────────
export const getMyChats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const chats = await prisma.chat.findMany({
      where: {
        participants: { some: { userId } },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                role: true,
                avatarUrl: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { fullName: true } },
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    // O'qilmagan xabarlar soni
    const result = await Promise.all(
      chats.map(async (chat) => {
        const participant = chat.participants.find((p) => p.userId === userId);
        const lastReadAt = participant?.lastReadAt || new Date(0);

        const unreadCount = await prisma.message.count({
          where: {
            chatId: chat.id,
            senderId: { not: userId },
            createdAt: { gt: lastReadAt },
          },
        });

        return {
          id: chat.id,
          type: chat.type,
          name: chat.name,
          lastMessage: chat.lastMessage,
          lastMessageAt: chat.lastMessageAt,
          unreadCount,
          participants: chat.participants.map((p) => ({
            userId: p.userId,
            user: p.user,
            lastReadAt: p.lastReadAt,
          })),
        };
      })
    );

    sendSuccess(res, result);
  } catch (err) {
    console.error('getMyChats error:', err);
    sendError(res, 'Chatlarni olishda xato', 500);
  }
};

// ─────────────────────────────────────────────────────────
// Chat xabarlarini olish
// ─────────────────────────────────────────────────────────
export const getChatMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const chatId = Number(req.params.chatId);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;

    // Foydalanuvchi bu chatda ishtirok etadimi?
    const participant = await prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!participant) {
      sendError(res, 'Ruxsat yo\'q', 403);
      return;
    }

    const messages = await prisma.message.findMany({
      where: { chatId },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            role: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // lastReadAt yangilash
    await prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId } },
      data: { lastReadAt: new Date() },
    });

    sendSuccess(res, messages.reverse());
  } catch (err) {
    console.error('getChatMessages error:', err);
    sendError(res, 'Xabarlarni olishda xato', 500);
  }
};

// ─────────────────────────────────────────────────────────
// To'g'ridan-to'g'ri chat yaratish (yoki mavjudini olish)
// ─────────────────────────────────────────────────────────
export const getOrCreateDirectChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const targetUserId = Number(req.params.targetUserId);

    if (userId === targetUserId) {
      sendError(res, 'O\'zingiz bilan chat ochib bo\'lmaydi', 400);
      return;
    }

    // Mavjud direct chat bormi? (faqat 2 kishi: userId va targetUserId)
    const existing = await prisma.chat.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: targetUserId } } },
        ],
      },
      include: {
        participants: {
          include: { user: { select: { id: true, fullName: true, role: true, avatarUrl: true } } },
        },
      },
    });

    if (existing) {
      // Verify exactly 2 participants (DIRECT chat)
      if (existing.participants.length === 2) {
        sendSuccess(res, existing);
        return;
      }
    }

    // Target user mavjudmi?
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      sendError(res, 'Foydalanuvchi topilmadi', 404);
      return;
    }

    // Yangi chat yaratish
    const chat = await prisma.chat.create({
      data: {
        type: 'DIRECT',
        participants: {
          create: [{ userId }, { userId: targetUserId }],
        },
      },
      include: {
        participants: {
          include: { user: { select: { id: true, fullName: true, role: true, avatarUrl: true } } },
        },
      },
    });

    sendSuccess(res, chat, undefined, 201);
  } catch (err) {
    console.error('getOrCreateDirectChat error:', err);
    sendError(res, 'Chat yaratishda xato', 500);
  }
};

// ─────────────────────────────────────────────────────────
// Guruh chati yaratish yoki olish
// ─────────────────────────────────────────────────────────
export const getOrCreateGroupChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = Number(req.params.groupId);

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        teacher: { include: { user: { select: { id: true } } } },
        groupStudents: {
          where: { status: 'ACTIVE' },
          include: {
            student: {
              include: {
                user: { select: { id: true } },
              },
            },
          },
        },
        chat: { include: { participants: true } },
      },
    });

    if (!group) {
      sendError(res, 'Guruh topilmadi', 404);
      return;
    }

    // Mavjud chatni qaytarish — ustozni har doim ishtirokchi sifatida saqlash
    if (group.chat) {
      await prisma.chatParticipant.upsert({
        where: { chatId_userId: { chatId: group.chat.id, userId: group.teacher.userId } },
        update: {},
        create: { chatId: group.chat.id, userId: group.teacher.userId },
      });
      sendSuccess(res, group.chat);
      return;
    }

    // A'zolar to'plami
    const memberIds = new Set<number>();
    memberIds.add(group.teacher.userId);
    group.groupStudents.forEach((gs) => {
      memberIds.add(gs.student.userId);
    });

    const chat = await prisma.chat.create({
      data: {
        type: 'GROUP',
        name: group.name,
        groupId: group.id,
        participants: {
          create: Array.from(memberIds).map((uid) => ({ userId: uid })),
        },
      },
      include: { participants: true },
    });

    sendSuccess(res, chat, undefined, 201);
  } catch (err) {
    console.error('getOrCreateGroupChat error:', err);
    sendError(res, 'Guruh chati yaratishda xato', 500);
  }
};

// ─────────────────────────────────────────────────────────
// Xabar yuborish (REST — socket.io bilan bir xil ishlaydi)
// ─────────────────────────────────────────────────────────
export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const chatId = Number(req.params.chatId);
    const { content, type = 'TEXT', fileUrl, fileName, fileSize, duration, tempId } = req.body;

    const participant = await prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!participant) {
      sendError(res, 'Ruxsat yo\'q', 403);
      return;
    }

    const msgType = (type as 'TEXT' | 'IMAGE' | 'FILE' | 'VOICE');

    const message = await prisma.message.create({
      data: {
        chatId,
        senderId: userId,
        content,
        type: msgType,
        fileUrl,
        fileName,
        fileSize,
        duration,
      },
      include: {
        sender: { select: { id: true, fullName: true, role: true, avatarUrl: true } },
      },
    });

    // Chat lastMessage yangilash
    const lastMsg =
      msgType === 'TEXT' ? (content?.slice(0, 100) || '') :
      msgType === 'IMAGE' ? '🖼 Rasm' :
      msgType === 'VOICE' ? '🎤 Ovozli xabar' :
      `📎 ${fileName || 'Fayl'}`;

    await prisma.chat.update({
      where: { id: chatId },
      data: {
        lastMessage: lastMsg,
        lastMessageAt: new Date(),
      },
    });

    // Socket orqali real-time broadcast
    const io = getIO();
    if (io) {
      io.to(`chat_${chatId}`).emit('new_message', { ...message, tempId });
      io.to(`chat_${chatId}`).emit('chat_updated', {
        chatId,
        lastMessage: lastMsg,
        lastMessageAt: message.createdAt,
      });
    }

    sendSuccess(res, message, undefined, 201);
  } catch (err) {
    console.error('sendMessage error:', err);
    sendError(res, 'Xabar yuborishda xato', 500);
  }
};

// ─────────────────────────────────────────────────────────
// Fayl yuklash
// ─────────────────────────────────────────────────────────
export const uploadFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      sendError(res, 'Fayl topilmadi', 400);
      return;
    }

    const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    const fileUrl = `${baseUrl}/uploads/chat/${req.file.filename}`;

    sendSuccess(res, {
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });
  } catch (err) {
    console.error('uploadFile error:', err);
    sendError(res, 'Fayl yuklashda xato', 500);
  }
};

// ─────────────────────────────────────────────────────────
// O'qildi belgisi
// ─────────────────────────────────────────────────────────
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const chatId = Number(req.params.chatId);

    await prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId } },
      data: { lastReadAt: new Date() },
    });

    // Socket orqali boshqa ishtirokchilarga xabar berish
    const io = getIO();
    if (io) {
      io.to(`chat_${chatId}`).emit('messages_read', { chatId, userId });
    }

    sendSuccess(res, { ok: true });
  } catch (err) {
    console.error('markAsRead error:', err);
    sendError(res, 'Xato', 500);
  }
};

// ─────────────────────────────────────────────────────────
// Guruh yaratilganda avtomatik chat ochish (ichki funksiya)
// ─────────────────────────────────────────────────────────
export const autoCreateGroupChat = async (groupId: number): Promise<void> => {
  try {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        teacher: { include: { user: true } },
        groupStudents: {
          where: { status: 'ACTIVE' },
          include: { student: { include: { user: true } } },
        },
        chat: true,
      },
    });

    if (!group || group.chat) return;

    const memberIds = new Set<number>();
    memberIds.add(group.teacher.userId);
    group.groupStudents.forEach((gs) => {
      memberIds.add(gs.student.userId);
    });

    await prisma.chat.create({
      data: {
        type: 'GROUP',
        name: group.name,
        groupId: group.id,
        participants: {
          create: Array.from(memberIds).map((uid) => ({ userId: uid })),
        },
      },
    });
  } catch (err) {
    console.error('autoCreateGroupChat error:', err);
  }
};

// ─────────────────────────────────────────────────────────
// O'quvchi guruhga qo'shilganda chatga ham qo'shish
// ─────────────────────────────────────────────────────────
export const addStudentToGroupChat = async (
  groupId: number,
  studentUserId: number,
  parentUserId?: number
): Promise<void> => {
  try {
    const chat = await prisma.chat.findFirst({ where: { groupId } });
    if (!chat) return;

    const toAdd = [studentUserId, ...(parentUserId ? [parentUserId] : [])];
    for (const uid of toAdd) {
      await prisma.chatParticipant.upsert({
        where: { chatId_userId: { chatId: chat.id, userId: uid } },
        update: {},
        create: { chatId: chat.id, userId: uid },
      });
    }
  } catch (err) {
    console.error('addStudentToGroupChat error:', err);
  }
};

// ─────────────────────────────────────────────────────────
// Chat ishtirokchilari (kim bilan to'g'ridan-to'g'ri chat ochish uchun)
// ─────────────────────────────────────────────────────────
export const getAvailableContacts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) { sendError(res, 'Topilmadi', 404); return; }

    let contacts: { id: number; fullName: string; role: string; avatarUrl: string | null }[] = [];

    if (user.role === 'ADMIN') {
      // Admin barcha ustozlar va o'quvchilar bilan gaplasha oladi
      contacts = await prisma.user.findMany({
        where: { id: { not: userId }, isActive: true },
        select: { id: true, fullName: true, role: true, avatarUrl: true },
        orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      });
    } else if (user.role === 'TEACHER') {
      // Ustoz o'z guruhlardagi o'quvchilar, ota-onalar va admin bilan
      const teacher = await prisma.teacher.findUnique({ where: { userId } });
      if (teacher) {
        const groups = await prisma.group.findMany({
          where: { teacherId: teacher.id, status: 'ACTIVE' },
          include: {
            groupStudents: {
              where: { status: 'ACTIVE' },
              include: {
                student: {
                  include: { user: true },
                },
              },
            },
          },
        });

        const ids = new Set<number>();
        groups.forEach((g) =>
          g.groupStudents.forEach((gs) => {
            ids.add(gs.student.userId);
          })
        );

        contacts = await prisma.user.findMany({
          where: {
            OR: [
              { id: { in: Array.from(ids) } },
              { role: 'ADMIN' },
            ],
            id: { not: userId },
            isActive: true,
          },
          select: { id: true, fullName: true, role: true, avatarUrl: true },
          orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
        });
      }
    } else if (user.role === 'STUDENT') {
      // O'quvchi: o'z ustozi, guruhdoshlari va admin bilan
      const student = await prisma.student.findUnique({ where: { userId } });
      if (student) {
        const groups = await prisma.groupStudent.findMany({
          where: { studentId: student.id, status: 'ACTIVE' },
          include: {
            group: {
              include: {
                teacher: { include: { user: true } },
                groupStudents: {
                  where: { status: 'ACTIVE' },
                  include: { student: { include: { user: true } } },
                },
              },
            },
          },
        });

        const teacherIds = groups.map((g) => g.group.teacher.userId);
        const groupmateIds = groups.flatMap((g) =>
          g.group.groupStudents
            .map((gs) => gs.student.userId)
            .filter((uid) => uid !== userId)
        );

        const allContactIds = [...new Set([...teacherIds, ...groupmateIds])];

        contacts = await prisma.user.findMany({
          where: {
            OR: [
              { id: { in: allContactIds } },
              { role: 'ADMIN' },
            ],
            id: { not: userId },
            isActive: true,
          },
          select: { id: true, fullName: true, role: true, avatarUrl: true },
          orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
        });
      }
    } else if (user.role === 'PARENT') {
      // Ota-ona o'z farzandlarining ustozlari va admin bilan
      const children = await prisma.student.findMany({
        where: { parentId: userId },
        include: {
          groupStudents: {
            where: { status: 'ACTIVE' },
            include: { group: { include: { teacher: { include: { user: true } } } } },
          },
          user: { select: { id: true } },
        },
      });

      const teacherIds = new Set<number>();
      const childIds = new Set<number>();
      children.forEach((c) => {
        childIds.add(c.userId);
        c.groupStudents.forEach((gs) => teacherIds.add(gs.group.teacher.userId));
      });

      contacts = await prisma.user.findMany({
        where: {
          OR: [
            { id: { in: [...teacherIds, ...childIds] } },
            { role: 'ADMIN' },
          ],
          id: { not: userId },
          isActive: true,
        },
        select: { id: true, fullName: true, role: true, avatarUrl: true },
        orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      });
    }

    sendSuccess(res, contacts);
  } catch (err) {
    console.error('getAvailableContacts error:', err);
    sendError(res, 'Kontaktlarni olishda xato', 500);
  }
};

// ─────────────────────────────────────────────────────────
// O'quvchi/ustoz uchun guruhlar ro'yxati (guruh chati bilan)
// ─────────────────────────────────────────────────────────
export const getMyGroups = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) { sendError(res, 'Topilmadi', 404); return; }

    type GroupInfo = {
      id: number;
      name: string;
      teacherName: string;
      chatId: number | null;
      memberCount: number;
    };

    let groups: GroupInfo[] = [];

    if (user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { userId } });
      if (!student) { sendSuccess(res, []); return; }

      const groupStudents = await prisma.groupStudent.findMany({
        where: { studentId: student.id, status: 'ACTIVE' },
        include: {
          group: {
            include: {
              teacher: { include: { user: { select: { id: true, fullName: true } } } },
              chat: { select: { id: true } },
              _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
            },
          },
        },
      });

      groups = groupStudents.map((gs) => ({
        id: gs.group.id,
        name: gs.group.name,
        teacherName: gs.group.teacher.user.fullName,
        chatId: gs.group.chat?.id ?? null,
        memberCount: gs.group._count.groupStudents,
      }));

    } else if (user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findUnique({ where: { userId } });
      if (!teacher) { sendSuccess(res, []); return; }

      const teacherGroups = await prisma.group.findMany({
        where: { teacherId: teacher.id, status: 'ACTIVE' },
        include: {
          chat: { select: { id: true } },
          _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
        },
      });

      groups = teacherGroups.map((g) => ({
        id: g.id,
        name: g.name,
        teacherName: user.fullName,
        chatId: g.chat?.id ?? null,
        memberCount: g._count.groupStudents,
      }));
    }

    sendSuccess(res, groups);
  } catch (err) {
    console.error('getMyGroups error:', err);
    sendError(res, 'Guruhlarni olishda xato', 500);
  }
};
