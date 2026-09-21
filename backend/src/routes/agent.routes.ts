/**
 * AGENT ROUTES — API-kalit bilan himoyalangan (JWT emas)
 * MCP server shu endpointlarni chaqiradi.
 */
import { Router } from 'express';
import { apiKeyAuth } from '../middleware/apiKey.middleware';
import {
  agentOverview, agentFinance, agentDebtors, agentBranches,
  agentStudents, agentGroups,
  agentCreatePayment, agentAdjustDebt, agentAnnouncement, agentCreateStudent,
} from '../controllers/agent.controller';

const router = Router();

// Barcha agent yo'llari API-kalit talab qiladi
router.use(apiKeyAuth);

// ── O'qish ──
router.get('/overview', agentOverview);
router.get('/finance', agentFinance);
router.get('/debtors', agentDebtors);
router.get('/branches', agentBranches);
router.get('/students', agentStudents);
router.get('/groups', agentGroups);

// ── Yozish (to'liq boshqaruv) ──
router.post('/payment', agentCreatePayment);
router.post('/adjust-debt', agentAdjustDebt);
router.post('/announcement', agentAnnouncement);
router.post('/student', agentCreateStudent);

export default router;
