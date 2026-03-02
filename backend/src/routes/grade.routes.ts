import { Router } from 'express';
import {
  getGrades, createGrade, createBulkGrades,
  updateGrade, deleteGrade,
  getGradebook, getStudentGrades, getGradeStats
} from '../controllers/grade.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// Statistika va maxsus
router.get('/gradebook/:groupId', authorize('ADMIN', 'TEACHER'), getGradebook);
router.get('/student/:studentId', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), getStudentGrades);
router.get('/stats', authorize('ADMIN', 'TEACHER'), getGradeStats);

// CRUD
router.get('/', authorize('ADMIN', 'TEACHER'), getGrades);
router.post('/', authorize('ADMIN', 'TEACHER'), createGrade);
router.post('/bulk', authorize('ADMIN', 'TEACHER'), createBulkGrades);
router.put('/:id', authorize('ADMIN', 'TEACHER'), updateGrade);
router.delete('/:id', authorize('ADMIN', 'TEACHER'), deleteGrade);

export default router;
