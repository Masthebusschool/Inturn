import { Router } from 'express';
import { notImplemented } from '../utils/notImplemented.js';

const router = Router();

router.post('/questions', notImplemented('interview.questions'));
router.post('/feedback', notImplemented('interview.feedback'));

export default router;
