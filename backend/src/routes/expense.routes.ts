import { Router } from 'express';
import {
  getExpenses, createExpense, updateExpense, deleteExpense,
  getFinanceSummary, getAllTimeBalance
} from '../controllers/expense.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// MUHIM: aniq routelar /:id dan oldin kelishi kerak!
router.get('/summary', authorize('ADMIN'), getFinanceSummary);
router.get('/all-time', authorize('ADMIN'), getAllTimeBalance);
router.get('/', authorize('ADMIN'), getExpenses);
router.post('/', authorize('ADMIN'), createExpense);
router.put('/:id', authorize('ADMIN'), updateExpense);
router.delete('/:id', authorize('ADMIN'), deleteExpense);

export default router;
