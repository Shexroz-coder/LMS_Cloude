import { Router } from 'express';
import {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getHolidayDatesInRange,
} from '../controllers/holiday.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// Barcha rollar bayram ro'yxatini ko'rishi mumkin
router.get('/', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), getHolidays);

// Berilgan oraliqda bayram sanalari
router.get('/dates', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), getHolidayDatesInRange);

// Faqat admin CRUD
router.post('/', authorize('ADMIN'), createHoliday);
router.put('/:id', authorize('ADMIN'), updateHoliday);
router.delete('/:id', authorize('ADMIN'), deleteHoliday);

export default router;
