import { Router } from 'express';
import { notImplemented } from '../utils/notImplemented.js';

const router = Router();

router.post('/', notImplemented('skillgap.analyze'));
router.get('/history', notImplemented('skillgap.history'));

export default router;
