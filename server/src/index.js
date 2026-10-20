import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import authRouter from './routes/auth.js';
import jobsRouter from './routes/jobs.js';
import skillgapRouter from './routes/skillgap.js';
import interviewRouter from './routes/interview.js';
import intelRouter from './routes/intel.js';
import shortlistRouter from './routes/shortlist.js';
import profileRouter from './routes/profile.js';
import resumesRouter from './routes/resumes.js';
import learningTasksRouter from './routes/learningTasks.js';

// Imports are hoisted, so load .env here before reading any process.env value.
dotenv.config({ quiet: true });

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// Health check: reports API status and MongoDB connection state.
const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    db: DB_STATES[mongoose.connection.readyState] ?? 'unknown',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/skillgap', skillgapRouter);
app.use('/api/interview', interviewRouter);
app.use('/api/intel', intelRouter);
app.use('/api/shortlist', shortlistRouter);
app.use('/api/profile', profileRouter);
app.use('/api/resumes', resumesRouter);
app.use('/api/learning-tasks', learningTasksRouter);

// JSON 404 for unknown /api routes (no '*' wildcard: Express 5 rejects it).
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found', path: req.originalUrl }));

app.listen(PORT, () => console.log(`[server] API listening on http://localhost:${PORT}`));

// Not awaited: the HTTP server stays up whether or not Mongo connects.
connectDB();
