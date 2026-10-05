import { Router } from 'express';
import { notImplemented } from '../utils/notImplemented.js';

const router = Router();

router.post('/signup', notImplemented('auth.signup'));
router.post('/login', notImplemented('auth.login'));
router.post('/logout', notImplemented('auth.logout'));
router.get('/me', notImplemented('auth.me'));

export default router;
