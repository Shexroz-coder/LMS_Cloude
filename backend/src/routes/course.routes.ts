import { Router } from 'express';
import { getCourses, createCourse, updateCourse, deleteCourse } from '../controllers/course.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authorize('ADMIN', 'TEACHER'), getCourses);
router.post('/', authorize('ADMIN'), createCourse);
router.put('/:id', authorize('ADMIN'), updateCourse);
router.delete('/:id', authorize('ADMIN'), deleteCourse);

export default router;
