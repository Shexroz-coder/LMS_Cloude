import { Router } from 'express';
import { getLessonMaterials, addLessonMaterial, deleteLessonMaterial } from '../controllers/lesson-material.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });
router.get('/', authorize('ADMIN', 'TEACHER', 'STUDENT'), getLessonMaterials);
router.post('/', authorize('ADMIN', 'TEACHER'), addLessonMaterial);
router.delete('/:id', authorize('ADMIN', 'TEACHER'), deleteLessonMaterial);
export default router;
