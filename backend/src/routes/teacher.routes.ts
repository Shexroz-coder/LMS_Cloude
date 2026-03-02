import { Router } from 'express';
import { getTeachers, getTeacherById, createTeacher, updateTeacher, deleteTeacher } from '../controllers/teacher.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authorize('ADMIN'), getTeachers);
router.post('/', authorize('ADMIN'), createTeacher);
router.get('/:id', authorize('ADMIN'), getTeacherById);
router.put('/:id', authorize('ADMIN'), updateTeacher);
router.delete('/:id', authorize('ADMIN'), deleteTeacher);

export default router;
