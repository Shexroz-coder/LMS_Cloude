import { Router } from 'express';
import { login, logout, refreshToken, getMe, changePassword, updateProfile } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// POST /api/v1/auth/login
router.post('/login', login);

// POST /api/v1/auth/refresh
router.post('/refresh', refreshToken);

// POST /api/v1/auth/logout
router.post('/logout', authenticate, logout);

// GET /api/v1/auth/me
router.get('/me', authenticate, getMe);

// PUT /api/v1/auth/change-password
router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, changePassword);

export default router;
