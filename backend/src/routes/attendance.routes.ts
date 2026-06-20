import { Router } from 'express';
import {
  markAttendance, getGroupAttendance, getAttendanceCalendar,
  getTodayAttendance, getAttendanceStats, getStudentAttendance, getTeacherAttendanceReport
} from '../controllers/attendance.controller';
import {
  exportByGroup, exportByStudent, exportMonthly,
  getGroupsList, getStudentsList,
} from '../controllers/attendance-export.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

router.post('/lesson', authorize('ADMIN', 'TEACHER'), markAttendance);
router.get('/today', authorize('ADMIN', 'TEACHER'), getTodayAttendance);
router.get('/stats', authorize('ADMIN', 'TEACHER'), getAttendanceStats);
router.get('/teacher-report', authorize('ADMIN'), getTeacherAttendanceReport);
router.get('/calendar/:groupId', authorize('ADMIN', 'TEACHER'), getAttendanceCalendar);
router.get('/group/:groupId', authorize('ADMIN', 'TEACHER'), getGroupAttendance);
router.get('/student/:studentId', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), getStudentAttendance);

// ── Excel Export (faqat Admin) ──────────────────────────────────────────────
router.get('/export/groups-list',   authorize('ADMIN'), getGroupsList);
router.get('/export/students-list', authorize('ADMIN'), getStudentsList);
router.get('/export/group',         authorize('ADMIN'), exportByGroup);
router.get('/export/student',       authorize('ADMIN'), exportByStudent);
router.get('/export/monthly',       authorize('ADMIN'), exportMonthly);

export default router;
