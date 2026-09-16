import { Router } from 'express';
import {
  getLeaderboard, awardCoins, deductCoins,
  getCoinHistory, autoAwardAttendanceCoins, awardBulkCoins
} from '../controllers/coin.controller';
import { authorize } from '../middleware/auth.middleware';
import { requirePerm } from '../middleware/permission.middleware';

const router = Router();

router.get('/leaderboard', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), getLeaderboard);
router.post('/award', authorize('ADMIN', 'TEACHER'), requirePerm('coins.award'), awardCoins);
router.post('/deduct', authorize('ADMIN'), deductCoins);
router.post('/auto-attendance', authorize('ADMIN', 'TEACHER'), autoAwardAttendanceCoins);
router.post('/award-bulk', authorize('ADMIN', 'TEACHER'), requirePerm('coins.award'), awardBulkCoins);
router.get('/history/:studentId', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), getCoinHistory);

export default router;
