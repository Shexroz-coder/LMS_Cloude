import { Router } from 'express';
import {
  getDashboardStats, getIncomeChart,
  getRecentPayments, getTodayLessons, getWeeklyAttendance,
  getTodaySchedule, getTeacherDebtors, getNewLeads,
  getBranchesComparison,
} from '../controllers/dashboard.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/stats', authorize('ADMIN', 'FOUNDER'), getDashboardStats);
router.get('/branches-comparison', authorize('ADMIN', 'FOUNDER'), getBranchesComparison);
router.get('/income-chart', authorize('ADMIN', 'FOUNDER'), getIncomeChart);
router.get('/recent-payments', authorize('ADMIN', 'FOUNDER'), getRecentPayments);
router.get('/today-lessons', authorize('ADMIN', 'TEACHER', 'FOUNDER'), getTodayLessons);
router.get('/weekly-attendance', authorize('ADMIN', 'FOUNDER'), getWeeklyAttendance);
router.get('/today-schedule', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), getTodaySchedule);
router.get('/teacher-debtors', authorize('TEACHER'), getTeacherDebtors);
router.get('/new-leads', authorize('ADMIN'), getNewLeads);

export default router;
