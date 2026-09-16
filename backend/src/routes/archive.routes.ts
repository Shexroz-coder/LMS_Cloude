import { Router } from 'express';
import { createArchive, getArchives, getArchiveDetail, restoreArchive } from '../controllers/archive.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// Barcha arxiv amallari — faqat ADMIN
router.get('/', authorize('ADMIN', 'FOUNDER'), getArchives);
router.get('/:id', authorize('ADMIN', 'FOUNDER'), getArchiveDetail);
router.post('/', authorize('ADMIN'), createArchive);
router.delete('/:id', authorize('ADMIN'), restoreArchive);

export default router;
