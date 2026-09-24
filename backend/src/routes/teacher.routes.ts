import { Router } from 'express';
import { getTeachers, getTeacherById, createTeacher, updateTeacher, deleteTeacher } from '../controllers/teacher.controller';
import { authorize } from '../middleware/auth.middleware';
import { adminOrManager } from '../middleware/permission.middleware';

const router = Router();

// Filial mas'uli guruh yaratishда ustoz tanlashi uchun ro'yxatni ko'ra oladi
router.get('/', adminOrManager('groups.manage'), getTeachers);
router.post('/', authorize('ADMIN'), createTeacher);
router.get('/:id', authorize('ADMIN'), getTeacherById);
router.put('/:id', authorize('ADMIN'), updateTeacher);
router.delete('/:id', authorize('ADMIN'), deleteTeacher);

export default router;
