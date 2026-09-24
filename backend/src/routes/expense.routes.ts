import { Router } from 'express';
import {
  getExpenses, createExpense, updateExpense, deleteExpense,
  getFinanceSummary, getAllTimeBalance
} from '../controllers/expense.controller';
import { authorize } from '../middleware/auth.middleware';
import { adminOrManager } from '../middleware/permission.middleware';

const router = Router();

// MUHIM: aniq routelar /:id dan oldin kelishi kerak!
// Mas'ul admin ham o'z filiali moliyasini boshqaradi (branchId avtomatik cheklanadi)
router.get('/summary', adminOrManager('finance.view'), getFinanceSummary);
router.get('/all-time', adminOrManager('finance.view'), getAllTimeBalance);
router.get('/', adminOrManager('finance.view'), getExpenses);
router.post('/', adminOrManager('finance.view'), createExpense);
router.put('/:id', adminOrManager('finance.view'), updateExpense);
router.delete('/:id', adminOrManager('finance.view'), deleteExpense);

export default router;
