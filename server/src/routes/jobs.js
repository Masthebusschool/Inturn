import { Router } from 'express';
import { notImplemented } from '../utils/notImplemented.js';

const router = Router();

// ?q=&location= will call jobBoardService
router.get('/', notImplemented('jobs.search'));
router.get('/:id', notImplemented('jobs.detail'));

export default router;
