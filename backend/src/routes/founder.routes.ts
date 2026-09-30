import { Router } from 'express';
import { getFounderOverview, getFounderGroups } from '../controllers/founder.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// Faqat Founder (va Admin ham ko'ra oladi) uchun kengaytirilgan ko'rinishlar
router.get('/overview', authorize('FOUNDER', 'ADMIN'), getFounderOverview);
router.get('/groups', authorize('FOUNDER', 'ADMIN'), getFounderGroups);

export default router;
