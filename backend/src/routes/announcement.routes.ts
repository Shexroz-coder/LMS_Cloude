import { Router } from 'express';
import { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from '../controllers/announcement.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();
router.get('/', getAnnouncements);
router.post('/', authorize('ADMIN'), createAnnouncement);
router.put('/:id', authorize('ADMIN'), updateAnnouncement);
router.delete('/:id', authorize('ADMIN'), deleteAnnouncement);
export default router;
