import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { isLoggedIn } from '../middleware/authMiddleware.js';

const router = Router();

// GET /api/interview - Get the logged-in user's journal questions
router.get('/', isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const questions = [];
    for (const q of user.journalQuestions) {
      questions.push({
        id: q._id,
        sourceId: q.sourceId,
        category: q.category,
        company: q.company,
        text: q.text,
        tip: q.tip,
        response: q.savedResponse || '',
        savedResponse: q.savedResponse || '',
        savedAt: q.savedAt || '',
      });
    }

    res.json({
      userName: user.name,
      questions: questions,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/interview/questions - Add a community question to the user's journal
router.post('/questions', isLoggedIn, async (req, res) => {
  try {
    const { sourceId, category, company, text, tip } = req.body;

    // Validate question text
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Question text is required.' });
    }

    const cleanText = text.trim();

    // Safely check optional string fields so non-strings don't cause errors
    const cleanSourceId = typeof sourceId === 'string' ? sourceId.trim() : '';
    const cleanCategory = typeof category === 'string' && category.trim() ? category.trim() : 'General';
    const cleanCompany = typeof company === 'string' ? company.trim() : '';
    const cleanTip =
      typeof tip === 'string' && tip.trim()
        ? tip.trim()
        : 'Use the STAR method: Situation, Task, Action, and Result.';

    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cap maximum questions per user at 100
    if (user.journalQuestions.length >= 100) {
      return res.status(400).json({ error: 'You have reached the maximum of 100 journal questions.' });
    }

    // Case-insensitive duplicate check (checks both sourceId and lowercase text)
    const alreadyAdded = user.journalQuestions.some(
      (q) =>
        (cleanSourceId !== '' && q.sourceId === cleanSourceId) ||
        q.text.trim().toLowerCase() === cleanText.toLowerCase()
    );
    if (alreadyAdded) {
      return res.status(400).json({ error: 'Question is already in your journal.' });
    }

    user.journalQuestions.push({
      sourceId: cleanSourceId,
      category: cleanCategory,
      company: cleanCompany,
      text: cleanText,
      tip: cleanTip,
      savedResponse: '',
      savedAt: '',
    });

    await user.save();

    const added = user.journalQuestions[user.journalQuestions.length - 1];

    res.status(201).json({
      question: {
        id: added._id,
        sourceId: added.sourceId,
        category: added.category,
        company: added.company,
        text: added.text,
        tip: added.tip,
        response: '',
        savedResponse: '',
        savedAt: '',
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/interview/feedback - Save or clear a reflection response
router.post('/feedback', isLoggedIn, async (req, res) => {
  try {
    const { questionId, response } = req.body;

    // Validate questionId is a real MongoDB ObjectId
    if (!mongoose.isValidObjectId(questionId)) {
      return res.status(400).json({ error: 'Invalid question ID.' });
    }

    // Validate response is a string
    if (typeof response !== 'string') {
      return res.status(400).json({ error: 'Response must be text.' });
    }

    if (response.length > 4000) {
     return res.status(400).json({ error: 'Response must be 4000 characters or less.' });
    }

    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const question = user.journalQuestions.id(questionId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found in journal.' });
    }

    const cleanText = response.trim();
    question.savedResponse = cleanText;

    if (cleanText === '') {
      question.savedAt = '';
    } else {
      // Uses Asia/Singapore timezone so saved time is always accurate
      question.savedAt = new Date().toLocaleDateString('en-SG', {
        timeZone: 'Asia/Singapore',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    await user.save();

    res.json({
      savedResponse: question.savedResponse,
      savedAt: question.savedAt,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/interview/questions/:questionId - Remove a question from journal
router.delete('/questions/:questionId', isLoggedIn, async (req, res) => {
  try {
    const { questionId } = req.params;

    if (!mongoose.isValidObjectId(questionId)) {
      return res.status(400).json({ error: 'Invalid question ID.' });
    }

    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.journalQuestions.pull(questionId);
    await user.save();

    res.json({ message: 'Question removed from journal.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;