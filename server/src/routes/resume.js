import { Router } from 'express';
import { isLoggedIn } from '../middleware/authMiddleware.js';
import { receiveResumePdf } from '../middleware/uploadMiddleware.js';
import * as resumeController from '../controllers/resumeController.js';

const router = Router();

// Login is checked first, so the file is only read for logged-in users
router.get('/', isLoggedIn, resumeController.getResume);
router.post('/', isLoggedIn, receiveResumePdf, resumeController.uploadResume);
router.post('/analyze', isLoggedIn, resumeController.analyzeResume);

export default router;
