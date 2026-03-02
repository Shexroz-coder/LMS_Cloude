import { Router } from 'express';
import { aiChat, getAiContext } from '../controllers/ai-assistant.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// All authenticated roles can use the AI assistant
router.get('/context', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), getAiContext);
router.post('/chat', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), aiChat);

export default router;
