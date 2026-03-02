import { Router } from 'express';
import {
  getDashboardStats, getIncomeChart,
  getRecentPayments, getTodayLessons, getWeeklyAttendance
} from '../controllers/dashboard.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/stats', authorize('ADMIN'), getDashboardStats);
router.get('/income-chart', authorize('ADMIN'), getIncomeChart);
router.get('/recent-payments', authorize('ADMIN'), getRecentPayments);
router.get('/today-lessons', authorize('ADMIN', 'TEACHER'), getTodayLessons);
router.get('/weekly-attendance', authorize('ADMIN'), getWeeklyAttendance);

export default router;
