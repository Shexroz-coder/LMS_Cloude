import { Router } from 'express';
import {
  getGroups, getGroupById, createGroup,
  updateGroup, deleteGroup, getGroupStats,
  addSchedule, updateSchedule, deleteSchedule,
  addStudentToGroup, removeStudentFromGroup, transferStudent,
} from '../controllers/group.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authorize('ADMIN', 'TEACHER'), getGroups);
router.post('/', authorize('ADMIN'), createGroup);
router.get('/:id', authorize('ADMIN', 'TEACHER'), getGroupById);
router.put('/:id', authorize('ADMIN'), updateGroup);
router.delete('/:id', authorize('ADMIN'), deleteGroup);
router.get('/:id/stats', authorize('ADMIN', 'TEACHER'), getGroupStats);

// Jadval
router.post('/:id/schedules', authorize('ADMIN'), addSchedule);
router.put('/:id/schedules/:scheduleId', authorize('ADMIN'), updateSchedule);
router.delete('/:id/schedules/:scheduleId', authorize('ADMIN'), deleteSchedule);

// O'quvchi boshqaruvi
router.post('/:id/students', authorize('ADMIN'), addStudentToGroup);
router.delete('/:id/students/:studentId', authorize('ADMIN'), removeStudentFromGroup);
router.post('/:id/students/:studentId/transfer', authorize('ADMIN'), transferStudent);

export default router;
