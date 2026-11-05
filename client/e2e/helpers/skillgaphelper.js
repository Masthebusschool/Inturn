import { expect } from '@playwright/test';
import { pageUrl } from './authhelper';
import { newUserAtOnboarding, goToResumeStep } from './onboardinghelper';
import { buildResult, buildRescoredScore, buildTailorReply } from './skillgapfixtures';

// a real posting for the one real-Gemini smoke test - needs Python (which the test profile has,
// from onboarding) plus a few things it doesn't, so a real analysis produces a mix of
// met/partial/missing requirements
export const SAMPLE_JOB_DESCRIPTION = `We are hiring a Software Engineering Intern for our data platform team.
You will build internal tools in Python, write SQL queries against our Postgres warehouse for
reporting, and work with the team to expose data through REST APIs. Requirements: proficiency in
Python; comfortable writing SQL; understanding of REST API design; familiarity with Git. Experience
with React or Node.js is a plus.`;

// a new user, onboarded (Undergraduate + Python, no resume), on the Skill Gap page
export async function userAtSkillGap(page) {
    await newUserAtOnboarding(page);
    await goToResumeStep(page);
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page).toHaveURL(`${pageUrl}/jobs`);

    // stub the history list every page load fetches, so it never depends on real DB state
    await mockHistory(page, []);

    await page.goto(`${pageUrl}/skill-gap`);
    // the setup form mounts after an async profile check; wait for it to settle before
    // interacting, otherwise getByLabel can miss the inputs mid-render
    await expect(page.getByRole('heading', { name: 'Internship posting' })).toBeVisible();
}

// stubs GET /api/skillgap/history, which the page loads on mount and after every analysis
export async function mockHistory(page, results = []) {
    await page.route('**/api/skillgap/history', (route) => route.fulfill({ json: { results } }));
}

// stubs a successful POST /api/skillgap ("analyze"). Opening a fresh result with no stored
// draftScore auto-triggers one rescore before any edit (see SkillGapView.vue's openLoaded), so
// this also mocks that follow-up rescore to mirror the result - the shown score stays stable
// until a test deliberately calls mockRescore again to change the NEXT rescore response.
// Returns the fixture result used, so a test can refer to its fields without repeating them.
export async function mockAnalyze(page, result = buildResult()) {
    await page.route('**/api/skillgap', (route) => route.fulfill({ status: 201, json: { result, addedSkills: [] } }));
    await mockRescore(page, buildRescoredScore({
        atsScore: result.atsScore,
        band: result.band,
        requirements: result.requirements,
        matchedSkills: result.matchedSkills,
        missingSkills: result.missingSkills,
        recommendations: result.recommendations,
        ungradedCount: result.ungradedCount,
    }));
    return result;
}

// stubs a failing POST /api/skillgap, e.g. the AI service erroring out
export async function mockAnalyzeFailure(page, { status = 500, error = 'The AI service is unavailable. Please try again shortly.' } = {}) {
    await page.route('**/api/skillgap', (route) => route.fulfill({ status, json: { error } }));
}

// stubs the NEXT POST /api/skillgap/:id/rescore call (fired after a draft edit or a requirement
// self-report, e.g. "I have this") - call again later in a test to change what that next call returns
export async function mockRescore(page, score = buildRescoredScore()) {
    await page.route('**/api/skillgap/*/rescore', (route) => route.fulfill({ json: { score } }));
    return score;
}

// stubs one tailor-chat turn: the user's message echoed back plus a scripted assistant reply
export async function mockTailorReply(page, { reply = 'Focus on SQL first - it is a required skill your draft is missing.', suggestions = [] } = {}) {
    await page.route('**/api/skillgap/*/tailor', (route) => {
        const { message } = route.request().postDataJSON();
        route.fulfill({ json: buildTailorReply({ userMessage: message, reply, suggestions }) });
    });
}

// fills the internship posting form and submits it
export async function submitAnalysis(page, { title = 'Software Engineering Intern', company = '', description = SAMPLE_JOB_DESCRIPTION } = {}) {
    // no exact:true here: the label's accessible name includes the hidden required-field
    // marker ("Internship title *"), so exact match against the plain field name never hits
    await page.getByLabel('Internship title').fill(title);
    if (company) await page.getByLabel('Company').fill(company);
    await page.getByLabel('Internship description').fill(description);
    await page.getByRole('button', { name: 'Analyze' }).click();
}

// stubs a successful analysis, submits the form, and waits for the result workspace to render -
// the default, deterministic path every non-smoke test uses
export async function analyzeAndWait(page, { result, ...opts } = {}) {
    const r = await mockAnalyze(page, result);
    await submitAnalysis(page, opts);
    await expect(page.getByRole('region', { name: 'Score report' })).toBeVisible();
    return r;
}

// opens the Tailor chat pane: below the xxl breakpoint it is an offcanvas, closed by default
export async function openTailorChat(page) {
    await page.getByRole('button', { name: 'Tailor chat' }).and(page.locator(':visible')).click();
    await expect(page.getByLabel('Message to the tailoring assistant')).toBeVisible();
}
