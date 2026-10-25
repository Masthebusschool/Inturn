import { Router } from 'express';
import { isLoggedIn } from '../middleware/authMiddleware.js';
import * as profileController from '../controllers/profileController.js';

const router = Router();

router.get('/', isLoggedIn, profileController.getProfile);
router.put('/', isLoggedIn, profileController.updateProfile);

export default router;
