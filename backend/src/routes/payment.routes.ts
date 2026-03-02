import { Router } from 'express';
import {
  getPayments, createPayment, getFinanceSummary,
  generateMonthlyFees, getStudentPayments,
  setPaymentDueDay, getUpcomingDues,
  initiateOnlinePayment, onlinePaymentCallback,
  calculateStudentPayment, getStudentObligations,
} from '../controllers/payment.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// ── Static routes (/:id dan oldin!) ─────────────────────
router.get('/summary', authorize('ADMIN'), getFinanceSummary);
router.get('/upcoming-dues', authorize('ADMIN'), getUpcomingDues);
router.get('/student-obligations', authorize('ADMIN'), getStudentObligations);
router.post('/generate-fees', authorize('ADMIN'), generateMonthlyFees);
router.post('/online/initiate', authorize('ADMIN', 'PARENT', 'STUDENT'), initiateOnlinePayment);
router.post('/online/callback', onlinePaymentCallback);  // webhook (auth yoq)

// ── Student specific ─────────────────────────────────────
router.get('/student/:studentId/calculate', authorize('ADMIN', 'TEACHER', 'PARENT', 'STUDENT'), calculateStudentPayment);
router.get('/student/:studentId', authorize('ADMIN', 'TEACHER', 'PARENT', 'STUDENT'), getStudentPayments);
router.patch('/student/:studentId/due-day', authorize('ADMIN'), setPaymentDueDay);

// ── General ──────────────────────────────────────────────
router.get('/', authorize('ADMIN'), getPayments);
router.post('/', authorize('ADMIN'), createPayment);

export default router;
