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
  getBillingOverview, updateBillingConfig, waiveStudentDebt,
} from '../controllers/payment.controller';
import { authorize } from '../middleware/auth.middleware';
import { adminOrManager } from '../middleware/permission.middleware';

const router = Router();

// ── Static routes (/:id dan oldin!) ─────────────────────
// Filial mas'uli ham o'z filiali bo'yicha ko'ra oladi (branchId avtomatik cheklanadi)
router.get('/billing', adminOrManager('payments.view'), getBillingOverview);
router.get('/summary', adminOrManager('finance.view', { allowFounder: true }), getFinanceSummary);
router.get('/upcoming-dues', authorize('ADMIN'), getUpcomingDues);
router.get('/student-obligations', authorize('ADMIN'), getStudentObligations);
router.get('/debtors-review', adminOrManager('debtors.view'), getDebtorsReview);
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
router.patch('/student/:studentId/billing-config', authorize('ADMIN'), updateBillingConfig);
router.post('/student/:studentId/waive-debt', authorize('ADMIN'), waiveStudentDebt);
router.delete('/student/:studentId/promise', authorize('ADMIN'), clearPaymentPromise);

// ── General ──────────────────────────────────────────────
router.get('/', adminOrManager('payments.view', { allowFounder: true }), getPayments);
router.post('/', adminOrManager('payments.create'), createPayment);
router.put('/:id', authorize('ADMIN'), updatePayment);
router.delete('/:id', authorize('ADMIN'), deletePayment);

export default router;
