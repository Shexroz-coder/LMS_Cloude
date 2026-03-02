import { Router } from 'express';
import {
  getLeaderboard, awardCoins, deductCoins,
  getCoinHistory, autoAwardAttendanceCoins
} from '../controllers/coin.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/leaderboard', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), getLeaderboard);
router.post('/award', authorize('ADMIN', 'TEACHER'), awardCoins);
router.post('/deduct', authorize('ADMIN'), deductCoins);
router.post('/auto-attendance', authorize('ADMIN', 'TEACHER'), autoAwardAttendanceCoins);
router.get('/history/:studentId', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), getCoinHistory);

export default router;
