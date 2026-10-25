import { Router } from 'express';
import mongoose from 'mongoose';
import * as applcationController from '../controllers/applicationController.js';

const router = Router();

router.get('/', applcationController.getApplications);
router.post('/', applcationController.addApplication);
router.patch('/:id', applcationController.updateStatus);
router.patch('/:id/interview', applcationController.updateInterviewDate);
router.delete('/:id', applcationController.deleteSavedApplication);

export default router;