# Inturn
 
**Find, track and prepare for internships in Singapore, in one place.**
 
Inturn is a web application for university and polytechnic students. It brings internship discovery, application tracking, AI-assisted skill gap analysis and interview preparation together, so a student always knows what to do next, before and after they apply.
 
IS216 Web Application Development 2 group project, 2026-2027 Term 1.
 
| | |
|---|---|
| **Live app** | https://inturn-seven.vercel.app |
| **Git repository** | https://github.com/Masthebusschool/Inturn |
 
---
 
## Problem and solution
 
Most internship tools only track applications a student has already made. Students still struggle to find relevant roles, to see which skills a specific posting expects of them, and to prepare for interviews with realistic, role-specific practice.
 
Inturn covers that earlier stage:
 
1. **Discover** real internship listings from MyCareersFuture, ranked by how well they match the student's own profile.
2. **Track** each opportunity on a Kanban board from Saved to Offered.
3. **Close skill gaps** with an AI analysis of the student's resume against one specific posting, plus a tailored resume draft.
4. **Prepare** using real interview questions shared anonymously by other students, and practise answers in a personal STAR-format journal.
---
 
## Features
 
| Feature | What it does |
|---|---|
| **Landing page, sign up and log in** | Session-based authentication with live password-rule feedback. |
| **Onboarding** | Education level, institution, field of study, skills and target industries. An existing resume PDF can be uploaded and is parsed by Gemini into a structured resume. |
| **Job discovery** | Searchable, filterable internship listings from MyCareersFuture. Each card shows the percentage of its listed skills that match the student's profile, with a "Best Skill Match" sort. Internships can be saved in one click. |
| **Tracker board** | Kanban board (Saved, Applied, Interview, Offered) with drag and drop, per-card prep checklist, favourites, search and sort. Moving a card to Applied stamps today's date; moving it to Interview asks for a future interview date. |
| **Profile** | Skills, projects and experience on one profile resume that drives job matching and the AI features, plus an activity heatmap. |
| **My Resumes** | Multiple resumes per student, a split-view editor with live preview, and an instant rule-based resume check (contact details, education, experience, at least three skills). |
| **Skill gap analysis (AI)** | Gemini splits a posting into requirements, grades each against the resume (quoting the exact line that proves it), and drafts a tailored resume using only facts already in the profile. Includes re-scoring when the student confirms a skill, a tailor chat that asks for missing detail instead of inventing it, and a to-do list of missing skills. |
| **Interview intel** | Students share real interview experiences and questions anonymously. Posts can be upvoted and filtered by company and role. The author's identity is never sent to the browser. |
| **Interview journal** | Pick a question from the intel feed, write an answer in STAR form (situation, task, action, result) and save it against that question to revisit before the interview. |
| **Deployment**| The front end is hosted on Vercel and the API on Render (free tier), with MongoDB Atlas as the database. Vercel forwards /api requests to Render. The Render free instance sleeps when idle, so the first request after a quiet period can take up to about a minute to respond.
 
---
 
## Tech stack
 
| Layer | Technology |
|---|---|
| Front end | Vue 3, Vue Router, Bootstrap 5, Bootstrap Icons, Vite |
| Back end | Node.js, Express 5 |
| Data store | MongoDB (via Mongoose); user sessions are also stored in MongoDB |
| External APIs | MyCareersFuture public jobs API, Google Gemini API |
| End-to-end tests | Playwright |
| Server tests | Node's built-in test runner |
| Tooling | pnpm workspace (`client` and `server`) |
 
### Data store
 
MongoDB holds users, resumes, saved applications, skill gap results and history, learning tasks, interview intel posts, and journal answers. It also holds a daily snapshot of MyCareersFuture listings that job discovery searches, and a cache of Gemini verdicts so repeat analyses of the same posting are fast.
 
### External APIs
 
| API | Purpose | Integration |
|---|---|---|
| **MyCareersFuture** (`api.mycareersfuture.gov.sg`), Singapore's public job portal | Internship listings | A scheduled job (`server/src/scripts/syncJobs.js`, run daily by the GitHub Action `.github/workflows/sync-jobs.yml`) stores listings in MongoDB for fast search. The job detail page fetches the full posting live through the server’s /api/jobs/:id endpoint. |
| **Google Gemini** (`@google/genai`) | Resume parsing, requirement extraction, skill grading, tailored resume drafts and the tailor chat | All calls go through one gateway (`server/src/services/aiGateway.js`) that serialises requests, spaces them out, times them out and retries on overload or quota errors. |
 
---
 
## Getting started
 
### Prerequisites
 
- [Node.js](https://nodejs.org/) 22.12 or newer
- [pnpm](https://pnpm.io/installation)
- A MongoDB database: a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster or a local MongoDB
- A [Google Gemini API key](https://aistudio.google.com/apikey) (free tier is enough, but see the note on quota below)
- Git
### 1. Get the code and install
 
**From the submitted zip:** unzip it and open a terminal in the unzipped project folder (the one containing `client/`, `server/` and `package.json`).
 
**Or from GitHub:**
 
```bash
git clone https://github.com/Masthebusschool/Inturn.git
cd Inturn
```
 
Then, in either case:
 
```bash
pnpm install        # installs the root, client and server dependencies
```
 
### 2. Configure environment variables
 
```bash
cp server/.env.example server/.env
```
 
On Windows PowerShell use `copy server\.env.example server\.env`.
 
Then open `server/.env` and fill in:
 
| Variable | Description |
|---|---|
| `PORT` | API port. Use `3000` (the Vite dev proxy expects it). |
| `CLIENT_ORIGIN` | Front-end origin for CORS. Use `http://localhost:5173`. |
| `MONGODB_URI` | Your MongoDB connection string. |
| `SESSION_SECRET` | Any long random string. |
| `GEMINI_API_KEY` | Your Gemini API key. |
| `GEMINI_MODEL` | Gemini model name, e.g. `gemini-flash-lite-latest`. |
| `GEMINI_MIN_SPACING_MS` | Minimum gap between Gemini calls, e.g. `2000`. |
| `GEMINI_REQUEST_TIMEOUT_MS` | Per-request timeout, e.g. `45000`. |
 
`server/.env` is git-ignored. Never commit it.
 
Environment files: the submitted zip already includes the .env file with working credentials (database, Gemini API key and session secret), so you can skip step 2 and go straight to pnpm install and pnpm dev. If you clone from GitHub instead, follow step 2 to create your own.
 
### 3. Load internship listings (first run only)
 
Job discovery searches a snapshot of MyCareersFuture listings stored in MongoDB. A new database starts empty, so load it once:
 
```bash
pnpm --filter ./server run sync:jobs
```
 
This can take a while because it pulls the full listing set. In the deployed setup the snapshot is refreshed daily by the GitHub Action `sync-jobs.yml`.
 
### 4. Run the app
 
```bash
pnpm dev
```
 
This starts the Vue client and the Express API together.
 
| App | URL |
|---|---|
| Vue client (Vite) | http://localhost:5173 |
| Express API | http://localhost:3000 (health check: `/api/health`) |
 
To run one side only: `pnpm dev:client` or `pnpm dev:server`. The Vite dev server proxies `/api/*` to the Express API.
 
### 5. Try it
 
Open http://localhost:5173, click **Get started for free**, sign up with any name and email, and follow onboarding. Suggested path: onboarding (upload a resume PDF) → Job Discovery → Save an internship → Tracker Board → **Tailor Resume** on the saved card → move the card to Applied, then Interview → Interview Intel → Interview Journal.
 
**Demo account (optional):** Email: testing@gmail.com / Password: Ab123456

> **Gemini note:** a skill gap analysis on a posting that has not been analysed before makes three Gemini calls one after another and can take up to about two minutes. Results for the same posting are cached, so repeat runs are much faster. The Gemini free tier has a daily quota; if it runs out, AI features show a clear error and resume after the quota resets.
 
---
 
## Testing
 
### End-to-end tests (Playwright)
 
The e2e tests drive the real app in a browser and check complete user journeys, including both successful and failed paths.
 
**One-time setup** (from the repo root):
 
```bash
pnpm --filter ./client exec playwright install
```
 
**Run** (the app must be running first, see step 4):
 
```bash
# terminal 1: from the repo root
pnpm dev
 
# terminal 2: from the repo root
pnpm --filter ./client exec playwright test                      # all browsers
pnpm --filter ./client exec playwright test --project=chromium   # Chrome-family only (faster)
pnpm --filter ./client exec playwright test auth.spec.js         # one spec file
pnpm --filter ./client exec playwright test --ui                 # interactive UI mode
pnpm --filter ./client exec playwright show-report               # open the HTML report
```
 
Each test signs up its own brand-new account with a unique email, so the suite can be run repeatedly without clearing the database or sharing state between tests.
 
AI responses in the skill gap tests are mocked, so the suite is deterministic and does not use Gemini quota. One optional real-AI smoke test runs only when RUN_AI_TESTS=1 is set.
 
| Spec file | Journeys covered |
|---|---|
| `auth.spec.js` | Sign up and log in, including validation errors and wrong credentials |
| `profile.spec.js` | Onboarding, profile editing, change email, change password, delete account |
| `trackerboard.spec.js` | Moving cards between columns, interview date, card actions |
| `intelfeed.spec.js` | Posting, filtering and upvoting interview intel |
| `interviewjournal.spec.js` | Adding intel questions to the journal and saving STAR answers |
| `skillgap.spec.js` | Skill gap analysis, score report and the tailor chat |
 
Shared page actions live in `client/e2e/helpers/`, so each spec reads as a list of scenarios.
 
### Server tests
 
```bash
pnpm --filter ./server test
```
 
Runs the API and utility tests (authentication, profile, resumes, applications, skill gap logic and more) with Node's built-in test runner.
 
---
 
## Project structure
 
```
Inturn/
├── client/                  Vue 3 front end (Vite)
│   ├── src/
│   │   ├── views/           One file per page (Landing, Jobs, Kanban, SkillGap, ...)
│   │   ├── components/      Reusable UI (tracker cards, skill gap report, tailor chat, ...)
│   │   ├── router/          Routes and navigation guards
│   │   ├── stores/          Shared reactive state (auth, resume, job match)
│   │   ├── api/             Calls to the Express API
│   │   └── lib, utils/      Helpers
│   └── e2e/                 Playwright tests and helpers
├── server/                  Express API
│   └── src/
│       ├── routes/          REST endpoints (auth, jobs, applications, skillgap, intel, ...)
│       ├── controllers/     Request handling
│       ├── models/          Mongoose schemas
│       ├── services/        Gemini gateway and AI logic, job snapshot and search
│       ├── middleware/      Authentication guards
│       └── scripts/         syncJobs.js (MyCareersFuture snapshot)
└── .github/workflows/       Daily job-sync GitHub Action
```
 
---
 
## Responsible use of AI
 
Gemini only works from facts already in the student's profile and resume. The tailor chat is instructed to ask for missing detail instead of inventing experience, and every "met" verdict must quote the exact line of the resume that supports it. AI-generated resume text is a draft for the student to review and edit.
 
---
 
## Team
 
| Name | Main contributions |
|---|---|
| Mas Lutfir Rahman Bin Jumari | Skill gap analysis, tailor chat, Gemini integration, skill gap e2e tests |
| Charlene Woo Xin Ying | Search internships and sort/filter, intern application, search e2e test |
| Sui Ruirong | Auth, onboarding, profile, resume analysis, UI, auth and profile e2e tests |
| Muhammad Farhan Bin Abdul Rashid | Interview Journal, Intel Feed, journal and feed e2e tests |
| `<NAME>` | `<...>` |
 
---
 
## Disclaimer
 
Built as a coursework project for IS216 at Singapore Management University. It is not production software and comes with no warranty. Listings belong to their original posters on MyCareersFuture.
