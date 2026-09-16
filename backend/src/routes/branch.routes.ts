import { Router } from 'express';
import { getBranches, createBranch, updateBranch, assignToBranch } from '../controllers/branch.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// Ro'yxat — hamma autentifikatsiyalangan foydalanuvchilar (selector uchun)
router.get('/', getBranches);

// Boshqaruv — faqat ADMIN
router.post('/', authorize('ADMIN'), createBranch);
router.put('/:id', authorize('ADMIN'), updateBranch);
router.post('/:id/assign', authorize('ADMIN'), assignToBranch);

export default router;
