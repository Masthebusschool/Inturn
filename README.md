# Inturn — README

## 1. Git Repository
https://github.com/Masthebusschool/Inturn

## 2. Setup

Submission contents

The submitted zip file contains three items:
- Presentation slides (the first slide contains the link to the video presentation)
- README.md (this file)
- Application/ (the project folder, without `node_modules`)

Prerequisites
- Node.js 22.12 or newer
- pnpm (`npm install -g pnpm`)
- Internet connection (the application uses a cloud MongoDB database and external APIs)

Steps

1. Unzip the submission and open a terminal in the Application folder.
2. Install dependencies:
   
   pnpm install
   
3. The environment file server/.env is already included. It contains the database connection string and API keys, so no editing is needed. Please make sure it stays at Application/server/.env.


## 3. Run

Start the server and the client separately, each in its own terminal, starting from the Application folder.

Terminal 1 (server):

cd server
pnpm dev


Terminal 2 (client):

cd client
pnpm dev


- Web app (home page): http://localhost:5173
- API: http://localhost:3000 (health check: http://localhost:3000/api/health)

## 4. Test

Server tests (uses the database in `server/.env`):

pnpm --filter ./server test


**End-to-end tests 
Run a single feature:

npx playwright test e2e/auth.spec.js


View the HTML report after a run:

npx playwright show-report


Each spec covers both good-run and bad-run scenarios; the full scenario list is at the top of each file.

## 5. Login Details

| Email | Password |
| testing@gmail.com |Ab123456|
Python is inputted as a skill since one is required.

You can also create a new account at http://localhost:5173/signup.