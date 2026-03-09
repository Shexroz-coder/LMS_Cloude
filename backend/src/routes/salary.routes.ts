import { Router } from 'express';
import {
  getSalaries,
  paySalary,
  getSalaryHistory,
  calculateAllSalaries,
  calculateTeacherSalary,
  calculateMySalary,
} from '../controllers/salary.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// Live hisob-kitob endpointlari (calculate so'zini birinchi qo'yish kerak)
router.get('/calculate', authorize('ADMIN'), calculateAllSalaries);
router.get('/teacher/me/calculate', authorize('TEACHER'), calculateMySalary);
router.get('/teacher/:teacherId/calculate', authorize('ADMIN', 'TEACHER'), calculateTeacherSalary);

// Mavjud endpointlar
router.get('/', authorize('ADMIN'), getSalaries);
router.get('/history', authorize('ADMIN'), getSalaryHistory);
router.post('/pay', authorize('ADMIN'), paySalary);

export default router;
