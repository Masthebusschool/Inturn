import { test, expect } from '@playwright/test';
import {
    userAtSkillGap,
    submitAnalysis,
    analyzeAndWait,
    mockAnalyze,
    mockAnalyzeFailure,
    mockRescore,
    mockTailorReply,
    openTailorChat,
} from './helpers/skillgaphelper';
import { buildEntrySuggestion } from './helpers/skillgapfixtures';

/* List of all scenarios tested under this file

    Setup form: bad run scenarios
  1. User tries to analyze without an internship description
  2. The analysis fails (AI service error) and the form stays usable, then Retry succeeds

    Setup form: good run scenarios
  3. User runs an analysis and sees a score report with categories and requirement groups
  4. User confirms a missing requirement is actually met and the draft score updates

    Tailor chat: bad run scenarios
  5. User cannot send an empty message

    Tailor chat: good run scenarios
  6. User sends a message and sees a reply
  7. User applies a suggested new project entry and sees it in the draft editor

    Real AI smoke test (skipped unless RUN_AI_TESTS is set)
  8. User runs a real analysis end to end
 */

// every test below mocks the Skill Gap API (see helpers/skillgapfixtures.js), so the default
// run is deterministic and never calls Gemini - the one real call is the smoke test at the
// bottom of this file, which is skipped unless RUN_AI_TESTS is set.

test.describe('Skill Gap setup form', () => {
    test.beforeEach(async ({ page }) => {
        await userAtSkillGap(page);
    });

    // 1. Test Case Scenario: User tries to analyze without an internship description
    test('should require an internship description', async ({ page }) => {
        await page.getByLabel('Internship title').fill('Software Engineering Intern');
        await page.getByRole('button', { name: 'Analyze' }).click();

        // asserted on DOM state, not toBeVisible(): the feedback text's layout box is sized by a
        // CSS sibling combinator reacting to the textarea's is-invalid class, and WebKit has a
        // layout-invalidation timing bug there - it reports a 0x0 box until anything forces a
        // reflow (confirmed by forcing one: the box is correctly laid out immediately after)
        await expect(page.getByLabel('Internship description')).toHaveClass(/is-invalid/);
        await expect(page.getByText('Paste the internship description.')).toBeAttached();
    });

    // 2. Test Case Scenario: The analysis fails and the form stays usable, then Retry succeeds
    test('should show an error and stay usable when analysis fails, then recover on retry', async ({ page }) => {
        await mockAnalyzeFailure(page);
        await submitAnalysis(page);

        await expect(page.getByRole('alert')).toContainText('The AI service is unavailable. Please try again shortly.');
        await expect(page.getByRole('button', { name: 'Analyze' })).toBeEnabled();
        await expect(page.getByLabel('Internship title')).toBeEnabled();

        // the same form, unchanged, now succeeds once the service recovers
        await mockAnalyze(page);
        await page.getByRole('button', { name: 'Retry' }).click();

        await expect(page.getByRole('region', { name: 'Score report' })).toBeVisible();
    });

    // 3. Test Case Scenario: User runs an analysis and sees a score report
    test('should show a score report with categories and requirement groups after analyzing', async ({ page }) => {
        await analyzeAndWait(page);

        await expect(page.getByRole('heading', { name: 'Software Engineering Intern' })).toBeVisible();
        await expect(page.getByRole('img', { name: 'Score 62 out of 100' })).toBeVisible();
        // exact: true - a non-exact match also hits the "Full profile: 62 (Moderate match)" note
        await expect(page.getByText('Moderate match', { exact: true })).toBeVisible();
        await expect(page.getByText('Technical skills')).toBeVisible();
        await expect(page.getByText('Comfortable writing SQL')).toBeVisible();
        await expect(page.getByText('Met requirements (1)')).toBeVisible();
    });

    // 4. Test Case Scenario: User confirms a missing requirement is actually met
    test('should update the draft score when confirming a missing requirement', async ({ page }) => {
        await analyzeAndWait(page);
        // wait for the automatic post-analysis rescore to settle before changing what the
        // NEXT rescore call returns, so the two calls can't race each other
        await expect(page.getByText('Draft score up to date')).toBeVisible();
        await mockRescore(page);

        const sqlSelfReport = page.getByRole('group', { name: 'Self-report for Comfortable writing SQL' });
        await expect(page.getByRole('img', { name: 'Score 62 out of 100' })).toBeVisible();

        await sqlSelfReport.getByRole('button', { name: 'I have this' }).click();

        await expect(page.getByRole('img', { name: 'Score 82 out of 100' })).toBeVisible();

        // SQL is now a met requirement, so its row moved into the collapsed "Met requirements"
        // group - open it to check the self-report button still reflects the confirmation
        await page.getByText(/^Met requirements \(\d+\)$/).click();
        await expect(sqlSelfReport.getByRole('button', { name: 'I have this' })).toHaveAttribute('aria-pressed', 'true');
    });
});

test.describe('Tailor chat', () => {
    // every test starts with a mocked analysis already open and the chat pane visible
    test.beforeEach(async ({ page }) => {
        await userAtSkillGap(page);
        await analyzeAndWait(page);
        await openTailorChat(page);
    });

    // 5. Test Case Scenario: User cannot send an empty message
    test('should keep Send disabled for an empty message', async ({ page }) => {
        await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();
    });

    // 6. Test Case Scenario: User sends a message and sees a reply
    test('should reply to a chat message', async ({ page }) => {
        await mockTailorReply(page, { reply: 'Focus on SQL first - it is a required skill your draft is missing.' });

        await page.getByLabel('Message to the tailoring assistant').fill('What should I focus on improving first?');
        await page.getByRole('button', { name: 'Send' }).click();

        await expect(page.getByTestId('sg-msg-assistant').last()).toContainText('Focus on SQL first');
    });

    // 7. Test Case Scenario: User applies a suggested new project entry
    test('should add a suggested project entry to the draft editor', async ({ page }) => {
        await mockTailorReply(page, {
            reply: 'Here is a project you mentioned that I can add to your draft.',
            suggestions: [buildEntrySuggestion()],
        });

        await page.getByLabel('Message to the tailoring assistant').fill(
            'I also built a project called Campus Event Finder: a Flask REST API in Python backed '
            + 'by Postgres, so students could search campus events by date and location. Please add '
            + 'this as a new project in my draft.'
        );
        await page.getByRole('button', { name: 'Send' }).click();

        const suggestion = page.getByTestId('sg-suggestion');
        await expect(suggestion).toContainText('Campus Event Finder');
        await suggestion.getByRole('button', { name: 'Add' }).click();

        // below the xxl breakpoint, applying a suggestion closes the chat drawer to reveal the
        // draft edit it just made (SkillGapView.vue's onApply) - check the live draft editor instead
        await expect(page.getByLabel('Project name')).toHaveValue('Campus Event Finder');
    });
});

test.describe('Skill Gap (real AI smoke test)', () => {
    // 8. Test Case Scenario: User runs a real analysis end to end (no mocks - costs a real Gemini call)
    test('should analyze a real posting end to end', async ({ page }) => {
        test.skip(!process.env.RUN_AI_TESTS, 'set RUN_AI_TESTS=1 to run the real-Gemini smoke test');
        test.setTimeout(120_000);

        await userAtSkillGap(page);
        await submitAnalysis(page);

        // real Gemini call - assert on structure only, never on exact wording or score
        await expect(page.getByRole('region', { name: 'Score report' })).toBeVisible({ timeout: 90_000 });
        await expect(page.getByRole('img', { name: /^Score \d+ out of 100$/ })).toBeVisible();
    });
});
