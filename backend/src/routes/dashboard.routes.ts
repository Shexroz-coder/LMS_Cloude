import { Router } from 'express';
import {
  getDashboardStats, getIncomeChart,
  getRecentPayments, getTodayLessons, getWeeklyAttendance,
  getTodaySchedule, getTeacherDebtors, getNewLeads,
  getBranchesComparison,
} from '../controllers/dashboard.controller';
import { authorize } from '../middleware/auth.middleware';
import { adminOrManager } from '../middleware/permission.middleware';

const router = Router();

// Filial mas'uli (menejer) ham o'z filiali bo'yicha dashboard ko'radi
// (adminOrManager branchId ni avtomatik cheklaydi)
router.get('/stats', adminOrManager('finance.view', { allowFounder: true }), getDashboardStats);
router.get('/branches-comparison', authorize('ADMIN', 'FOUNDER'), getBranchesComparison);
router.get('/income-chart', adminOrManager('finance.view', { allowFounder: true }), getIncomeChart);
router.get('/recent-payments', adminOrManager('payments.view', { allowFounder: true }), getRecentPayments);
router.get('/today-lessons', authorize('ADMIN', 'TEACHER', 'FOUNDER'), getTodayLessons);
router.get('/weekly-attendance', adminOrManager('attendance.view', { allowFounder: true }), getWeeklyAttendance);
router.get('/today-schedule', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), getTodaySchedule);
router.get('/teacher-debtors', authorize('TEACHER'), getTeacherDebtors);
router.get('/new-leads', adminOrManager('students.view'), getNewLeads);

export default router;
