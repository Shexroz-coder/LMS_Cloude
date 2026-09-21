import { Router } from 'express';
import {
  getBranches, createBranch, updateBranch, assignToBranch,
  getBranchDetail, createRoom, updateRoom, deleteRoom, assignGroupsToRoom,
} from '../controllers/branch.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// Ro'yxat — hamma autentifikatsiyalangan foydalanuvchilar (selector uchun)
router.get('/', getBranches);

// Filial batafsil — ADMIN va FOUNDER
router.get('/:id/detail', authorize('ADMIN', 'FOUNDER'), getBranchDetail);

// Boshqaruv — faqat ADMIN
router.post('/', authorize('ADMIN'), createBranch);
router.put('/:id', authorize('ADMIN'), updateBranch);
router.post('/:id/assign', authorize('ADMIN'), assignToBranch);

// Xonalar — ADMIN
router.post('/:id/rooms', authorize('ADMIN'), createRoom);
router.put('/rooms/:roomId', authorize('ADMIN'), updateRoom);
router.delete('/rooms/:roomId', authorize('ADMIN'), deleteRoom);
router.post('/rooms/:roomId/assign-groups', authorize('ADMIN'), assignGroupsToRoom);

export default router;
