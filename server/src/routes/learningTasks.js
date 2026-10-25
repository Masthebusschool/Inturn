import { Router } from 'express';
import mongoose from 'mongoose';
import { isLoggedIn, loadUser } from '../middleware/authMiddleware.js';
import { apiErrors } from '../middleware/apiErrors.js';
import { compareTasks } from '../utils/learningTasks.js';
import LearningTask from '../models/LearningTask.js';

const router = Router();
router.use(isLoggedIn, loadUser);

// Live row owned by the caller, or null after sending 404 (not 403, so ids can't be probed).
// Not .lean(): PATCH/DELETE need a live document to call .save()/.deleteOne() on.
async function loadOwned(req, res, select = '') {
  const q = mongoose.isValidObjectId(req.params.id) ? LearningTask.findById(req.params.id) : null;
  const task = q ? await q.select(select) : null;
  if (!task || !task.user.equals(req.user._id)) {
    res.status(404).json({ error: 'Task not found' });
    return null;
  }
  return task;
}

router.get('/', async (req, res) => {
  const tasks = await LearningTask.find({ user: req.user._id }).select('-user').lean();
  // Sorted here, not in Mongo: Mongo sorts missing deadlines first, we want them last.
  res.json({ tasks: tasks.sort(compareTasks) });
});

router.patch('/:id', async (req, res) => {
  const status = req.body?.status;
  if (status !== 'pending' && status !== 'done') {
    return res.status(400).json({ error: 'Status must be "pending" or "done".' });
  }
  const task = await loadOwned(req, res);
  if (!task) return;
  task.doneAt = status === 'done' ? task.doneAt || new Date() : undefined;
  task.status = status;
  await task.save();
  res.json({ task });
});

router.delete('/:id', async (req, res) => {
  const task = await loadOwned(req, res);
  if (!task) return;
  await task.deleteOne();
  res.json({ ok: true });
});

router.use(apiErrors);

export default router;
