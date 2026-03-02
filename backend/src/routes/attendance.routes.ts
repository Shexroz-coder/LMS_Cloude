import { Router } from 'express';
import {
  markAttendance, getGroupAttendance,
  getTodayAttendance, getAttendanceStats, getStudentAttendance
} from '../controllers/attendance.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

router.post('/lesson', authorize('ADMIN', 'TEACHER'), markAttendance);
router.get('/today', authorize('ADMIN', 'TEACHER'), getTodayAttendance);
router.get('/stats', authorize('ADMIN', 'TEACHER'), getAttendanceStats);
router.get('/group/:groupId', authorize('ADMIN', 'TEACHER'), getGroupAttendance);
router.get('/student/:studentId', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), getStudentAttendance);

export default router;
