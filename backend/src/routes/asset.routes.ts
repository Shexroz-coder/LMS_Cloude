import { Router } from 'express';
import { getAssets, createAsset, updateAsset, deleteAsset } from '../controllers/asset.controller';
import { authorize } from '../middleware/auth.middleware';
import { adminOrManager } from '../middleware/permission.middleware';

const router = Router();

// Ko'rish — admin yoki filial mas'uli (o'z filiali bo'yicha cheklanadi)
router.get('/', adminOrManager('students.view'), getAssets);

// Boshqaruv — ADMIN
router.post('/', authorize('ADMIN'), createAsset);
router.put('/:id', authorize('ADMIN'), updateAsset);
router.delete('/:id', authorize('ADMIN'), deleteAsset);

export default router;
