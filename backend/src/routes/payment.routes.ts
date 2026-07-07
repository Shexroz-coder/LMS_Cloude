import { Router } from 'express';
import {
  getPayments, createPayment, getFinanceSummary,
  generateMonthlyFees, getStudentPayments,
  setPaymentDueDay, getUpcomingDues,
  initiateOnlinePayment, onlinePaymentCallback,
  calculateStudentPayment, getStudentObligations,
  updatePayment, deletePayment, getArchivedPayments,
  setPaymentPromise, clearPaymentPromise,
  getStudentCalendar,
  getDebtorsReview, notifyDebtors,
  adjustStudentDebt,
} from '../controllers/payment.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// ── Static routes (/:id dan oldin!) ─────────────────────
router.get('/summary', authorize('ADMIN'), getFinanceSummary);
router.get('/upcoming-dues', authorize('ADMIN'), getUpcomingDues);
router.get('/student-obligations', authorize('ADMIN'), getStudentObligations);
router.get('/debtors-review', authorize('ADMIN'), getDebtorsReview);
router.post('/notify-debtors', authorize('ADMIN'), notifyDebtors);
router.get('/archive', authorize('ADMIN'), getArchivedPayments);
router.post('/generate-fees', authorize('ADMIN'), generateMonthlyFees);
router.post('/online/initiate', authorize('ADMIN', 'PARENT', 'STUDENT'), initiateOnlinePayment);
router.post('/online/callback', onlinePaymentCallback);  // webhook (auth yoq)

// ── Student specific ─────────────────────────────────────
router.get('/student/:studentId/calendar', authorize('ADMIN', 'TEACHER', 'PARENT', 'STUDENT'), getStudentCalendar);
router.get('/student/:studentId/calculate', authorize('ADMIN', 'TEACHER', 'PARENT', 'STUDENT'), calculateStudentPayment);
router.get('/student/:studentId', authorize('ADMIN', 'TEACHER', 'PARENT', 'STUDENT'), getStudentPayments);
router.patch('/student/:studentId/due-day', authorize('ADMIN'), setPaymentDueDay);
router.patch('/student/:studentId/promise', authorize('ADMIN'), setPaymentPromise);
router.patch('/student/:studentId/adjust-debt', authorize('ADMIN'), adjustStudentDebt);
router.delete('/student/:studentId/promise', authorize('ADMIN'), clearPaymentPromise);

// ── General ──────────────────────────────────────────────
router.get('/', authorize('ADMIN'), getPayments);
router.post('/', authorize('ADMIN'), createPayment);
router.put('/:id', authorize('ADMIN'), updatePayment);
router.delete('/:id', authorize('ADMIN'), deletePayment);

export default router;
