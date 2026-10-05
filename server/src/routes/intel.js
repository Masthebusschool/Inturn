import { Router } from 'express';
import { notImplemented } from '../utils/notImplemented.js';

const router = Router();

router.get('/', notImplemented('intel.list'));
router.post('/', notImplemented('intel.create'));
router.post('/:id/upvote', notImplemented('intel.upvote'));

export default router;
