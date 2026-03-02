import { Router } from 'express';
import { paymeWebhook } from '../controllers/payme.controller';

const router = Router();

// PayMe Subscribe API JSON-RPC webhook
// Auth: Basic base64("Paycom:{PAYME_KEY}") — controller ichida tekshiriladi
router.post('/webhook', paymeWebhook);

export default router;
