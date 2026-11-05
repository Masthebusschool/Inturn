import { test, expect } from '@playwright/test';

// helpers
import { goToNav } from './helpers/navhelper';
import { loginTestUser } from './helpers/loginhelper';
import {
    waitForFeed,
    getPost,
    openShareForm,
    publishPost,
    deletePost,
    setTypeFilter,
    setCompanyFilter } from './helpers/intelhelper';

/* List of all scenarios tested under this file
    Good run scenarios
  1. User logs in and shares an experience post that persists
  2. User logs in and shares an interview questions post with a few questions that persist
  3. User logs in and filters the feed by company and post type, then resets the filters
  4. User logs in and upvotes a post, then removes the upvote
  5. User logs in and deletes their own post using the confirmation popup
  6. User logs in and sees a loading spinner instead of the empty state while the feed loads
  7. User logs in on a tablet sized screen and the page still fits

    Bad run scenarios
  8. User logs in and tries to publish a post with missing details
  9. User logs in and tries to add too many questions, or questions that are too long
 */

const pageUrl = 'http://localhost:5173';

// a made up company so the tests never touch real posts
const COMPANY = 'E2E Intel Co';

test.describe('Interview Intel', () => {
    // the tests share one account and the same test data, so run them one after another
    test.describe.configure({ mode: 'default' });

    // every test starts logged in on the interview intel page
    test.beforeEach(async ({ page }) => {
        await loginTestUser(page, 'test@edu.sg', 'Testing12');

        // bridge portion to reach interview intel:
        await goToNav(page, 'Interview Intel');
        await waitForFeed(page);
    });

    // remove the test posts so the next run starts clean
    test.afterEach(async ({ page }) => {
        // reload first so a popup left open by a failed test doesn't block the page
        await page.reload();
        await waitForFeed(page);
        await deletePost(page, COMPANY);
    });

    // 1. Test Case Scenario: User logs in and shares an experience post that persists
    test('user logs in and shares an experience post that persists', async ({ page }) => {
        await publishPost(page, {
            type: 'Experience',
            company: COMPANY,
            title: 'My E2E interview',
            body: 'The interview was friendly and focused on my projects.',
        });
        const post = getPost(page, COMPANY);

        // the form closes and the new post shows up as the user's own
        await expect(page.getByRole('heading', { name: 'Share interview intel' })).toBeHidden();
        await expect(post).toContainText('Experience');
        await expect(post).toContainText('My E2E interview');
        await expect(post).toContainText('The interview was friendly and focused on my projects.');
        await expect(post).toContainText('(You)');
        await expect(post.getByTitle('Delete your post')).toBeVisible();

        // reload to check the post was saved
        await page.reload();
        await waitForFeed(page);
        await expect(post).toContainText('My E2E interview');
    });

    // 2. Test Case Scenario: User logs in and shares an interview questions post that persists
    test('user logs in and shares an interview questions post with a few questions that persist', async ({ page }) => {
        await publishPost(page, {
            type: 'Interview questions',
            company: COMPANY,
            title: 'E2E questions',
            questions: ['What is a unit test?', 'What is an end to end test?', 'Explain REST in simple terms'],
        });
        const questions = getPost(page, COMPANY).getByRole('listitem');

        // each question is its own line in the post
        await expect(questions).toHaveCount(3);
        await expect(questions.nth(0)).toHaveText('What is a unit test?');
        await expect(questions.nth(1)).toHaveText('What is an end to end test?');
        await expect(questions.nth(2)).toHaveText('Explain REST in simple terms');

        // reload to check all 3 were saved
        await page.reload();
        await waitForFeed(page);
        await expect(questions).toHaveCount(3);
    });

    // 3. Test Case Scenario: User logs in and filters the feed by company and post type, then resets
    test('user logs in and filters the feed by company and post type then resets', async ({ page }) => {
        await publishPost(page, {
            type: 'Interview questions',
            company: COMPANY,
            questions: ['Filter question?'],
        });
        const post = getPost(page, COMPANY);

        // filtering by this company leaves only the one post
        await setCompanyFilter(page, COMPANY);
        await expect(page.locator('article')).toHaveCount(1);
        await expect(post).toBeVisible();
        await expect(page.getByText('1 post', { exact: true })).toBeVisible();

        // it is an interview questions post, so filtering by Experience leaves nothing
        await setTypeFilter(page, 'Experience');
        await expect(page.getByText('No posts match these filters')).toBeVisible();
        await expect(post).toBeHidden();

        // reset brings the feed back
        await page.getByRole('button', { name: 'Reset filters' }).click();
        await expect(page.getByText('No posts match these filters')).toBeHidden();
        await expect(post).toBeVisible();
    });

    // 4. Test Case Scenario: User logs in and upvotes a post, then removes the upvote
    test('user logs in and upvotes a post then removes the upvote', async ({ page }) => {
        await publishPost(page, { type: 'Experience', company: COMPANY, body: 'Upvote me.' });
        const upvote = getPost(page, COMPANY).getByRole('button', { name: /Upvote/ });

        await expect(upvote).toHaveAttribute('aria-pressed', 'false');
        await expect(upvote).toContainText('0');

        await upvote.click();
        await expect(upvote).toHaveAttribute('aria-pressed', 'true');
        await expect(upvote).toContainText('1');

        // reload to check the upvote was saved
        await page.reload();
        await waitForFeed(page);
        await expect(upvote).toHaveAttribute('aria-pressed', 'true');

        // clicking again takes the upvote back
        await upvote.click();
        await expect(upvote).toHaveAttribute('aria-pressed', 'false');
        await expect(upvote).toContainText('0');
    });

    // 5. Test Case Scenario: User logs in and deletes their own post using the confirmation popup
    test('user logs in and deletes their own post using the confirmation popup', async ({ page }) => {
        await publishPost(page, { type: 'Experience', company: COMPANY, body: 'Delete me.' });
        const post = getPost(page, COMPANY);
        const dialog = page.getByRole('dialog');

        // cancel keeps the post
        await post.getByTitle('Delete your post').click();
        await expect(dialog.getByRole('heading', { name: 'Delete your post?' })).toBeVisible();
        await dialog.getByRole('button', { name: 'Cancel' }).click();
        await expect(dialog).toBeHidden();
        await expect(post).toBeVisible();

        // so does the Escape key
        await post.getByTitle('Delete your post').click();
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(post).toBeVisible();

        // confirming deletes it
        await post.getByTitle('Delete your post').click();
        await dialog.getByRole('button', { name: 'Delete post' }).click();
        await expect(post).toHaveCount(0);

        // reload to check it stays deleted
        await page.reload();
        await waitForFeed(page);
        await expect(post).toHaveCount(0);
    });

    // 6. Test Case Scenario: User logs in and sees a loading spinner while the feed loads
    test('user logs in and sees a loading spinner instead of the empty state while the feed loads', async ({ page }) => {
        // slow the feed down so the loading state is easy to see
        await page.route('**/api/intel', async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            await route.continue();
        });
        await page.reload();

        await expect(page.getByText('Loading interview intel...')).toBeVisible();
        await expect(page.getByText('No community intel shared yet')).toBeHidden();

        // the page appears once the posts arrive
        await waitForFeed(page);
        await expect(page.getByText('Loading interview intel...')).toBeHidden();

        await page.unroute('**/api/intel');
    });

    // 7. Test Case Scenario: User logs in on a tablet sized screen and the page still fits
    test('user logs in on a tablet sized screen and the page still fits', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 900 });
        await page.reload();
        await waitForFeed(page);

        // the share button text stays on one line (two lines would be 60px or taller)
        const shareButton = await page.getByRole('button', { name: 'Share your experience' }).first().boundingBox();
        expect(shareButton.height).toBeLessThan(56);

        // the page never scrolls sideways
        const scrollsSideways = await page.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth
        );
        expect(scrollsSideways).toBe(false);
    });

    // 8. Test Case Scenario: User logs in and tries to publish a post with missing details
    test('user logs in and the share form will not publish with missing details', async ({ page }) => {
        await openShareForm(page);
        const publish = page.getByRole('button', { name: 'Publish post' });

        // nothing filled in
        await expect(publish).toBeDisabled();

        // only spaces don't count as text
        await page.locator('#post-company').fill('   ');
        await page.locator('#post-role').fill('   ');
        await page.locator('#post-title').fill('   ');
        await page.locator('#post-body').fill('   ');
        await expect(publish).toBeDisabled();

        // a real company, role and title but still no experience text
        await page.locator('#post-company').fill(COMPANY);
        await page.locator('#post-role').fill('QA Intern');
        await page.locator('#post-title').fill('Missing body');
        await page.locator('#post-body').fill('');
        await expect(publish).toBeDisabled();

        // adding the experience text unlocks it
        await page.locator('#post-body').fill('Some experience text');
        await expect(publish).toBeEnabled();

        // interview questions need at least one real question instead
        await page.locator('#post-type').selectOption('Interview questions');
        await expect(publish).toBeDisabled();
        await page.getByPlaceholder('Type one question').fill('   ');
        await expect(publish).toBeDisabled();
        await page.getByPlaceholder('Type one question').fill('What is REST?');
        await expect(publish).toBeEnabled();

        // cancel closes the form and nothing was posted
        await page.getByRole('button', { name: 'Cancel' }).click();
        await expect(page.getByRole('heading', { name: 'Share interview intel' })).toBeHidden();
        await expect(getPost(page, COMPANY)).toHaveCount(0);
    });

    // 9. Test Case Scenario: User logs in and tries to add too many questions, or questions that are too long
    test('user logs in and the question boxes stop at 300 characters and 10 questions', async ({ page }) => {
        await openShareForm(page);
        await page.locator('#post-type').selectOption('Interview questions');
        const boxes = page.getByPlaceholder('Type one question');
        const addButton = page.getByRole('button', { name: 'Add another question' });

        // typing more than 300 characters stops at 300
        await boxes.first().pressSequentially('x'.repeat(320));
        await expect(boxes.first()).toHaveValue('x'.repeat(300));

        // keep adding boxes until there are 10
        for (let i = 2; i <= 10; i++) {
            await addButton.click();
        }
        await expect(boxes).toHaveCount(10);

        // at the limit the add button locks
        await expect(addButton).toBeDisabled();

        // removing a question unlocks it again
        await page.getByRole('button', { name: 'Remove question' }).first().click();
        await expect(boxes).toHaveCount(9);
        await expect(addButton).toBeEnabled();
    });
});
