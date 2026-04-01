import { Router } from 'express';
import {
  getSalaries,
  paySalary,
  getSalaryHistory,
  calculateAllSalaries,
  calculateTeacherSalary,
  calculateMySalary,
  getStaffUsers,
  payStaffSalary,
  getStaffSalaryHistory,
} from '../controllers/salary.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// ── Ustoz oylik hisob-kitob (calculate birinchi bo'lishi kerak)
router.get('/calculate', authorize('ADMIN'), calculateAllSalaries);
router.get('/teacher/me/calculate', authorize('TEACHER'), calculateMySalary);
router.get('/teacher/:teacherId/calculate', authorize('ADMIN', 'TEACHER'), calculateTeacherSalary);

// ── Ustoz oylik boshqaruv
router.get('/', authorize('ADMIN'), getSalaries);
router.get('/history', authorize('ADMIN'), getSalaryHistory);
router.post('/pay', authorize('ADMIN'), paySalary);

// ── Xodimlar ish haqi (ustoz bo'lmaganlar)
router.get('/staff/users', authorize('ADMIN'), getStaffUsers);
router.get('/staff/history', authorize('ADMIN'), getStaffSalaryHistory);
router.post('/staff/pay', authorize('ADMIN'), payStaffSalary);

export default router;
