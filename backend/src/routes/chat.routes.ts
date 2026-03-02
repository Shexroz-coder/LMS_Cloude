import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getMyChats,
  getChatMessages,
  getOrCreateDirectChat,
  getOrCreateGroupChat,
  sendMessage,
  uploadFile,
  markAsRead,
  getAvailableContacts,
} from '../controllers/chat.controller';

const router = Router();

// ── Upload papkasini tayyorlash ────────────────────────
const uploadDir = path.join(process.env.UPLOAD_DIR || './uploads', 'chat');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    // Ruxsat etilgan turlar
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
      'text/plain',
      'video/mp4', 'video/webm',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Ruxsat etilmagan fayl turi: ${file.mimetype}`));
    }
  },
});

// ── Routes ─────────────────────────────────────────────
router.get('/', getMyChats);
router.get('/contacts', getAvailableContacts);
router.get('/:chatId/messages', getChatMessages);
router.post('/:chatId/messages', sendMessage);
router.post('/:chatId/read', markAsRead);
router.post('/direct/:targetUserId', getOrCreateDirectChat);
router.post('/group/:groupId', getOrCreateGroupChat);
router.post('/upload', upload.single('file'), uploadFile);

export default router;
