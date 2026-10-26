import { Router } from 'express';
import * as applcationController from '../controllers/applicationController.js';

const router = Router();

router.get('/', applcationController.getApplications);
router.post('/', applcationController.addApplication);
router.patch('/:id', applcationController.updateStatus);
router.patch('/:id/interview', applcationController.updateInterviewDate);
router.patch('/:id/favourite', applcationController.updateFavourite);
router.post('/:id/tasks', applcationController.addTask);
router.patch('/:id/tasks/:taskId', applcationController.updateTask);
router.delete('/:id/tasks/:taskId', applcationController.deleteTask);
router.delete('/:id', applcationController.deleteSavedApplication);

export default router;