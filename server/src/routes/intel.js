import { Router } from 'express';
import mongoose from 'mongoose';
import IntelPost from '../models/IntelPost.js';
import { isLoggedIn } from '../middleware/authMiddleware.js';

const router = Router();

// 1. GET /api/intel - Get all community posts
router.get('/', async (req, res) => {
  try {
    // If database is empty on first run, insert the 4 sample posts
    const count = await IntelPost.countDocuments();
    if (count === 0) {
      await IntelPost.insertMany([
        {
          type: 'Experience',
          company: 'GovTech',
          role: 'Full-Stack Engineering Intern',
          title: 'My GovTech technical interview experience',
          questions: [],
          experience:
            'The interview was conversational and focused more on how I made engineering decisions than getting a perfect answer. I walked through one of my projects, then discussed API design, testing, and a production bug I had fixed.',
          upvotes: 42,
        },
        {
          type: 'Interview questions',
          company: 'Grab',
          role: 'Software Engineering Intern',
          title: 'Questions from my Grab engineering interview',
          experience: '',
          questions: [
            'Explain how you would design a food-order status tracker, including real-time updates and failure states',
            'Tell me about a disagreement in a team project and what you learned from it',
          ],
          upvotes: 31,
        },
        {
          type: 'Experience',
          company: 'Shopee',
          role: 'Product Management Intern',
          title: 'How my Shopee PM intern interviews went',
          questions: [],
          experience:
            'Two rounds: a behavioural chat about a project I led, then a product case on improving seller onboarding. They cared most about how I structured my thinking and used data to back my choices.',
          upvotes: 27,
        },
        {
          type: 'Interview questions',
          company: 'DBS',
          role: 'Data Analyst Intern',
          title: 'SQL and case questions from DBS',
          experience: '',
          questions: [
            'Write a query using a window function to rank customers by monthly spend',
            'Weekly active users dropped 10% last week. How would you investigate?',
            'Explain the difference between an INNER JOIN and a LEFT JOIN with an example',
          ],
          upvotes: 19,
        },
      ]);
    }

    // Fetch all posts sorted from newest to oldest (-1)
    const dbPosts = await IntelPost.find().sort({ createdAt: -1 });

    // Read current user ID if logged in
    const userId = req.session?.user?.id;

    // Format posts for the frontend (author ID is NEVER sent, only isOwner: true/false)
    const formattedPosts = [];
    for (const p of dbPosts) {
      const formattedDate = new Date(p.createdAt).toLocaleDateString('en-SG', {
        timeZone: 'Asia/Singapore',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const hasUpvoted = userId ? p.upvotedBy.includes(userId) : false;
      const isOwner = Boolean(userId && p.author && p.author.toString() === userId.toString());

      formattedPosts.push({
        id: p._id,
        type: p.type,
        company: p.company,
        role: p.role,
        title: p.title,
        questions: p.questions,
        experience: p.experience,
        upvotes: p.upvotes,
        upvoted: hasUpvoted,
        isOwner: isOwner,
        date: formattedDate,
      });
    }

    res.json({ posts: formattedPosts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. POST /api/intel - Create a new post (Protected by isLoggedIn)
router.post('/', isLoggedIn, async (req, res) => {
  try {
    const { type, company, role, title, questions, experience } = req.body;

    // 1. Check that company, role, and title are strings and not just empty spaces
    if (
      typeof company !== 'string' || !company.trim() ||
      typeof role !== 'string' || !role.trim() ||
      typeof title !== 'string' || !title.trim()
    ) {
      return res.status(400).json({ error: 'Company, role, and title must be valid text.' });
    }

    // 2. Check that post type is one of the two allowed options
    if (type !== 'Experience' && type !== 'Interview questions') {
      return res.status(400).json({ error: 'Invalid post type.' });
    }

    // 3. If it's an Experience post, make sure experience text is provided
    if (type === 'Experience') {
      if (typeof experience !== 'string' || !experience.trim()) {
        return res.status(400).json({ error: 'Please share your interview experience.' });
      }
    }

    // 4. If it's an Interview questions post, make sure questions is a non-empty array
    let cleanQuestions = [];
    if (type === 'Interview questions') {
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: 'Please provide at least one interview question.' });
      }
      cleanQuestions = questions
        .filter((q) => typeof q === 'string' && q.trim() !== '')
        .map((q) => q.trim());

      if (cleanQuestions.length === 0) {
        return res.status(400).json({ error: 'Please provide at least one valid question.' });
      }
    }

    const newPost = await IntelPost.create({
      author: req.session.user.id, // Stored in DB only, never exposed in response
      type: type,
      company: company.trim(),
      role: role.trim(),
      title: title.trim(),
      questions: cleanQuestions,
      experience: type === 'Experience' ? experience.trim() : '',
    });

    const formattedDate = new Date(newPost.createdAt).toLocaleDateString('en-SG', {
      timeZone: 'Asia/Singapore',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    res.status(201).json({
      post: {
        id: newPost._id,
        type: newPost.type,
        company: newPost.company,
        role: newPost.role,
        title: newPost.title,
        questions: newPost.questions,
        experience: newPost.experience,
        upvotes: newPost.upvotes,
        upvoted: false,
        isOwner: true, // Current user just created this post
        date: formattedDate,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 3. POST /api/intel/:id/upvote - Toggle upvote (Protected by isLoggedIn)
router.post('/:id/upvote', isLoggedIn, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid post ID.' });
    }

    const post = await IntelPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const userId = req.session.user.id;

    if (post.upvotedBy.includes(userId)) {
      post.upvotedBy.pull(userId);
      post.upvotes = Math.max(0, post.upvotes - 1);
    } else {
      post.upvotedBy.push(userId);
      post.upvotes += 1;
    }

    await post.save();

    res.json({
      upvotes: post.upvotes,
      upvoted: post.upvotedBy.includes(userId),
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 4. DELETE /api/intel/:id - Delete a post (Only the author can delete their own post)
router.delete('/:id', isLoggedIn, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid post ID.' });
    }

    const post = await IntelPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const userId = req.session.user.id;

    // Make sure the logged-in user is the author of this post
    if (!post.author || post.author.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'You can only delete your own posts.' });
    }

    await post.deleteOne();
    res.json({ message: 'Post deleted.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;