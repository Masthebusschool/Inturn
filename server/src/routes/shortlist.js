import { Router } from 'express';
import { notImplemented } from '../utils/notImplemented.js';

const router = Router();

router.get('/', notImplemented('shortlist.list'));
router.post('/', notImplemented('shortlist.add'));
router.patch('/:id', notImplemented('shortlist.updateStatus'));
router.delete('/:id', notImplemented('shortlist.remove'));

export default router;
