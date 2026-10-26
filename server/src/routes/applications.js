import { Router } from 'express';
import { isLoggedIn } from '../middleware/authMiddleware.js';
import * as applcationController from '../controllers/applicationController.js';

const router = Router();

router.get('/', isLoggedIn, applcationController.getApplications);
router.post('/', isLoggedIn, applcationController.addApplication);
router.patch('/:id', isLoggedIn, applcationController.updateStatus);
router.patch('/:id/interview', isLoggedIn, applcationController.updateInterviewDate);
router.patch('/:id/favourite', isLoggedIn, applcationController.updateFavourite);
router.post('/:id/tasks', isLoggedIn, applcationController.addTask);
router.patch('/:id/tasks/:taskId', isLoggedIn, applcationController.updateTask);
router.delete('/:id/tasks/:taskId', isLoggedIn, applcationController.deleteTask);
router.delete('/:id', isLoggedIn, applcationController.deleteSavedApplication);

export default router;