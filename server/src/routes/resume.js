import { Router } from 'express';
import { isLoggedIn } from '../middleware/authMiddleware.js';
import { receiveResumePdf } from '../middleware/uploadMiddleware.js';
import * as resumeController from '../controllers/resumeController.js';

const router = Router();

// Login is checked first, so the file is only read for logged-in users
router.post('/', isLoggedIn, receiveResumePdf, resumeController.uploadResume);
router.get('/:id/review', isLoggedIn, resumeController.reviewResume);

export default router;
