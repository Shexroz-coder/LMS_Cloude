import { Router } from 'express';
import { getPermissionMatrix, setPermission, getMyPermissions, createFounder } from '../controllers/permission.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// O'z ruxsatlarini olish — hamma
router.get('/my', getMyPermissions);

// Matritsa boshqaruvi — faqat ADMIN
router.get('/', authorize('ADMIN'), getPermissionMatrix);
router.put('/', authorize('ADMIN'), setPermission);
router.post('/founder', authorize('ADMIN'), createFounder);

export default router;
