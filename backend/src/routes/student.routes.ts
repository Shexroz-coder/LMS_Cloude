import { Router } from 'express';
import {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  addToGroup,
  removeFromGroup,
  getAttendanceStats,
  getDebtors,
  updateGroupJoinedAt,
} from '../controllers/student.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// Qarzdorlar (authenticate allaqachon routes/index.ts da)
router.get('/debtors', authorize('ADMIN'), getDebtors);

// CRUD
router.get('/', authorize('ADMIN', 'TEACHER'), getStudents);
router.post('/', authorize('ADMIN'), createStudent);
router.get('/:id', authorize('ADMIN', 'TEACHER', 'PARENT'), getStudentById);
router.put('/:id', authorize('ADMIN'), updateStudent);
router.delete('/:id', authorize('ADMIN'), deleteStudent);

// Guruh boshqaruvi
router.post('/:id/groups/:groupId', authorize('ADMIN'), addToGroup);
router.patch('/:id/groups/:groupId/joined-at', authorize('ADMIN'), updateGroupJoinedAt);
router.delete('/:id/groups/:groupId', authorize('ADMIN'), removeFromGroup);

// Statistika
router.get('/:id/attendance-stats', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), getAttendanceStats);

export default router;
