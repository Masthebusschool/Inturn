# Inturn

> IS216 Group Project — Proposal

## Project Overview

Inturn is a web application that helps university and polytechnic students prepare for internship and job applications *before* they submit them, rather than organise applications after the fact. Most existing tools focus on tracking applications a student has already made: pipelines, deadlines, and reflections. That leaves a real gap upstream — students still struggle to find relevant roles, understand what skills a specific posting actually expects of them, and prepare for interviews with realistic, role-specific practice.

This project addresses that gap directly: it pulls live internship/job listings from a public job-board API, uses AI to compare a student's profile against a specific posting to surface concrete skill gaps, runs an AI-generated mock interview tailored to that posting, and lets students learn from each other through a crowdsourced feed of real interview questions asked at specific companies. The result is a proactive companion for the discovery-and-preparation stage of the job search, complementing (rather than duplicating) after-the-fact tracking tools.

## Objectives

- Help students discover relevant internship/job opportunities through a live, searchable external data feed.
- Give students a personalised, AI-driven skill-gap analysis comparing their profile against a specific job posting.
- Provide a safe space to practice interview skills, with AI-generated, role-specific questions and structured feedback on their answers.
- Build a searchable, crowdsourced knowledge base of real interview experiences shared anonymously by peers.
- Encourage a proactive, preparation-focused approach to the internship search, rather than a purely reactive, tracking-only approach.

## Features

| Feature | What It Does |
|---|---|
| **Account & Profile Setup** | Sign up/login; students add skills, education level, and target roles/industries. Foundation for personalisation and for attributing shortlist items and intel posts to a user. |
| **Live Job/Internship Discovery Feed** | Pulls real listings from a job-board API (e.g. Arbeitnow, and/or Adzuna), searchable and filterable by keyword, role, and location. This satisfies the external public-API requirement. |
| **AI Skill-Gap Analysis** | Student selects a job posting and their profile; AI highlights overlapping skills, flags gaps, and suggests concrete next steps to close them. |
| **AI Mock Interview Simulator** | Student picks a saved posting; AI generates behavioural and technical questions tailored to that role. Student answers by text or voice; AI gives structured feedback on the response. |
| **Crowdsourced Interview Intel Feed** | Anonymised posts where students share real interview questions they were asked at specific companies/roles. Searchable, filterable by company/role, and upvotable. |
| **Lightweight Shortlist** | A simple saved-jobs list with a status tag (Interested / Applied / Heard back) to keep track of what a student is targeting. |

### Stretch Goals (if time permits)

- Company insight aggregation — roll up all skill-gap runs and intel posts for a given company into a single "commonly asked about" summary.
- Resume auto-parsing — upload a resume PDF and have AI extract skills/experience automatically.
- Threaded comments on interview intel posts.
- AI moderation on submitted intel posts before they go live.
- Contribution gamification (points/badges) to encourage students to share their own interview intel.

## Tech Stack

- **Bootstrap** — styling and responsive layout
- **Vue.js** — front-end interactivity
- **Node.js with Express.js** — backend
- **Web Speech API** (browser-native) — optional voice input during mock interviews

## Data Store

- **MongoDB** — stores user profiles, saved/shortlisted jobs, skill-gap analysis history, and crowdsourced interview intel posts (with upvotes).

## APIs Used

| API | Access | Purpose |
|---|---|---|
| [Arbeitnow Job Board API](https://www.arbeitnow.com/api/job-board-api) | Free, no API key required | Live internship/job listings |
| [Adzuna API](https://developer.adzuna.com) | Free tier (app ID + key) | Supplementary job listings and salary data; useful if broader geographic coverage is needed |
| AI/LLM API (e.g. Google Gemini API, or Groq) | — | Powers the skill-gap analysis and the mock interview question generation & feedback |

## Getting Started (Development)

### Prerequisites
- [Node.js](https://nodejs.org/) 22.12 or newer (developed on Node 24)
- [pnpm](https://pnpm.io/installation) (developed on pnpm 12)
- A MongoDB connection string (local or a free MongoDB Atlas cluster). Optional at first: the API still starts without one.

### Setup
```bash
pnpm install                          # installs root, client and server dependencies
cp server/.env.example server/.env    # then fill in real values (never commit .env)
pnpm dev                              # starts the Vue client and Express API together
```

| App | URL |
|---|---|
| Vue client (Vite) | http://localhost:5173 |
| Express API | http://localhost:3000 (health check: `/api/health`) |

The Vite dev server proxies `/api/*` to the Express API, so front-end code can call `fetch('/api/...')` directly. To run one app alone, use `pnpm dev:client` or `pnpm dev:server`.
