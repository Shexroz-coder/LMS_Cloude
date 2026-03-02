import { Router } from 'express';
import { getSalaries, paySalary, getSalaryHistory } from '../controllers/salary.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();
router.get('/', authorize('ADMIN'), getSalaries);
router.get('/history', authorize('ADMIN'), getSalaryHistory);
router.post('/pay', authorize('ADMIN'), paySalary);
export default router;
