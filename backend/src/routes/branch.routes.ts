import { Router } from 'express';
import {
  getBranches, createBranch, updateBranch, assignToBranch,
  getBranchDetail, createRoom, updateRoom, deleteRoom, assignGroupsToRoom,
  getBranchManager, assignManager, removeManager, setManagerPermission,
  transferToBranch,
} from '../controllers/branch.controller';
import { authorize } from '../middleware/auth.middleware';
import { adminOrManager } from '../middleware/permission.middleware';

const router = Router();

// Ro'yxat — hamma autentifikatsiyalangan foydalanuvchilar (selector uchun)
router.get('/', getBranches);

// Filial batafsil — ADMIN, FOUNDER yoki shu filial MAS'ULI
router.get('/:id/detail', adminOrManager('students.view'), getBranchDetail);

// Boshqaruv — faqat ADMIN
router.post('/', authorize('ADMIN'), createBranch);
router.put('/:id', authorize('ADMIN'), updateBranch);
router.post('/:id/assign', authorize('ADMIN'), assignToBranch);
router.post('/transfer', authorize('ADMIN'), transferToBranch);

// Xonalar — ADMIN
router.post('/:id/rooms', authorize('ADMIN'), createRoom);
router.put('/rooms/:roomId', authorize('ADMIN'), updateRoom);
router.delete('/rooms/:roomId', authorize('ADMIN'), deleteRoom);
router.post('/rooms/:roomId/assign-groups', authorize('ADMIN'), assignGroupsToRoom);

// Filial mas'uli (ustoz-menejer) — ADMIN boshqaradi
router.get('/:id/manager', authorize('ADMIN'), getBranchManager);
router.post('/:id/manager', authorize('ADMIN'), assignManager);
router.delete('/:id/manager/:userId', authorize('ADMIN'), removeManager);
router.put('/manager/:userId/permission', authorize('ADMIN'), setManagerPermission);

export default router;
