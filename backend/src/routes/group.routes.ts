import { Router } from 'express';
import {
  getGroups, getGroupById, createGroup,
  updateGroup, deleteGroup, getGroupStats,
  addSchedule, updateSchedule, deleteSchedule,
  addStudentToGroup, removeStudentFromGroup, transferStudent,
} from '../controllers/group.controller';
import { authorize } from '../middleware/auth.middleware';
import { adminOrManager } from '../middleware/permission.middleware';

const router = Router();

router.get('/', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), getGroups);
router.post('/', adminOrManager('groups.manage'), createGroup);
router.get('/:id', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), getGroupById);
router.put('/:id', adminOrManager('groups.manage'), updateGroup);
router.delete('/:id', adminOrManager('groups.manage'), deleteGroup);
router.get('/:id/stats', authorize('ADMIN', 'TEACHER'), getGroupStats);

// Jadval — mas'ul ham qo'sha/tahrirlashi mumkin
router.post('/:id/schedules', adminOrManager('groups.manage'), addSchedule);
router.put('/:id/schedules/:scheduleId', adminOrManager('groups.manage'), updateSchedule);
router.delete('/:id/schedules/:scheduleId', adminOrManager('groups.manage'), deleteSchedule);

// O'quvchi boshqaruvi
router.post('/:id/students', adminOrManager('students.create'), addStudentToGroup);
router.delete('/:id/students/:studentId', adminOrManager('students.create'), removeStudentFromGroup);
router.post('/:id/students/:studentId/transfer', adminOrManager('students.create'), transferStudent);

export default router;
