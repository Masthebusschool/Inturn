import { Router } from 'express';
import { isLoggedIn } from '../middleware/authMiddleware.js';
import * as applcationController from '../controllers/applicationController.js';

const router = Router();

router.get('/', isLoggedIn, applcationController.getApplications);
router.post('/', isLoggedIn, applcationController.addApplication);
router.patch('/:id', isLoggedIn, applcationController.updateStatus);
router.patch('/:id/interview', isLoggedIn, applcationController.updateInterviewDate);
router.delete('/:id', isLoggedIn, applcationController.deleteSavedApplication);

export default router;