import { test, expect } from '@playwright/test';

// helpers
import { goToNav } from './helpers/navhelper';
import { loginTestUser } from './helpers/loginhelper';
import { waitForFeed, publishPost, deletePost } from './helpers/intelhelper';
import {
    waitForJournal,
    getJournalItem,
    getReflectionBox,
    openCommunityModal,
    getCommunityCard,
    addFromCommunity,
    removeQuestions,
    clearReflectionIfAny } from './helpers/journalhelper';

/* List of all scenarios tested under this file
    Good run scenarios
  1. User logs in and saves a reflection on a starter question that persists
  2. User logs in, shares questions on Interview Intel, then adds one to the journal and it persists
  3. User logs in and clears a saved reflection using the confirmation popup
  4. User logs in and removes a community question from the journal using the confirmation popup
  5. User logs in and sees a loading spinner instead of the empty state while the journal loads

    Bad run scenarios
  6. User logs in and tries to save or clear an empty reflection
  7. User logs in and tries to add the same community question twice
 */

const pageUrl = 'http://localhost:5173';

// made up company and questions so the tests never touch real posts
const COMPANY = 'E2E Journal Co';
const QUESTION_ONE = 'E2E journal question one';
const QUESTION_TWO = 'E2E journal question two';

// one of the starter questions every new journal comes with
const STARTER = 'disagreement with a teammate';
const STARTER_FULL = 'Tell me about a disagreement with a teammate over a technical approach.';
const REFLECTION = 'I listened first and we agreed on a plan';

// shares a post with two questions on Interview Intel, then comes back to the journal
async function shareQuestionsThenReturn(page) {
    await goToNav(page, 'Interview Intel');
    await waitForFeed(page);
    await publishPost(page, {
        type: 'Interview questions',
        company: COMPANY,
        title: 'E2E journal questions',
        questions: [QUESTION_ONE, QUESTION_TWO],
    });
    await goToNav(page, 'Interview Journal');
    await waitForJournal(page);
}

test.describe('Interview Journal', () => {
    // the tests share one account and the same test data, so run them one after another
    test.describe.configure({ mode: 'default' });

    // every test starts logged in on the interview journal
    test.beforeEach(async ({ page }) => {
        await loginTestUser(page, 'test@edu.sg', 'Testing12');

        // bridge portion to reach the interview journal:
        await goToNav(page, 'Interview Journal');
        await waitForJournal(page);
    });

    // put the journal and the feed back how they were so the next run starts clean
    test.afterEach(async ({ page }) => {
        // reload first so a popup left open by a failed test doesn't block the page
        await page.reload();
        await waitForJournal(page);

        // remove the community questions the tests added
        await removeQuestions(page, 'E2E journal question');

        // clear the reflection the tests wrote on the starter question
        if (await getJournalItem(page, STARTER).count() > 0) {
            await getJournalItem(page, STARTER).click();
            await clearReflectionIfAny(page);
        }

        // delete the post the tests shared
        await goToNav(page, 'Interview Intel');
        await waitForFeed(page);
        await deletePost(page, COMPANY);
    });

    // 1. Test Case Scenario: User logs in and saves a reflection on a starter question that persists
    test('user logs in and saves a reflection on a starter question that persists', async ({ page }) => {
        // open one of the starter questions
        await getJournalItem(page, STARTER).click();
        await expect(page.getByRole('heading', { name: STARTER_FULL })).toBeVisible();

        // typing shows the word count and the unsaved changes label
        const box = getReflectionBox(page);
        await box.fill(REFLECTION);
        await expect(page.getByText('9 words')).toBeVisible();
        await expect(page.getByText('Unsaved changes')).toBeVisible();

        // saving shows the message and the question is marked as saved
        await page.getByRole('button', { name: 'Save Response' }).click();
        await expect(page.getByText('Saved to your Interview Journal!')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
        await expect(getJournalItem(page, STARTER)).toContainText('Saved');

        // reload to check the reflection was saved
        await page.reload();
        await waitForJournal(page);
        await getJournalItem(page, STARTER).click();
        await expect(getReflectionBox(page)).toHaveValue(REFLECTION);
    });

    // 2. Test Case Scenario: User logs in, shares questions on Interview Intel, then adds one to the journal
    test('user logs in, shares questions on Interview Intel then adds one to the journal and it persists', async ({ page }) => {
        // this test visits two pages and cleans up both, so give it 3x the usual time
        test.slow();

        await shareQuestionsThenReturn(page);

        // the shared questions show up in the community popup
        await openCommunityModal(page);
        const card = getCommunityCard(page, QUESTION_ONE);
        await expect(card).toContainText(COMPANY);
        await expect(card).toContainText('Shared anonymously');

        // adding one locks its button
        await card.getByRole('button', { name: 'Add to journal' }).click();
        await expect(card.getByRole('button', { name: 'Added to journal' })).toBeDisabled();
        await page.getByRole('button', { name: 'Close modal' }).click();

        // the added question is in the list and is the one selected in the editor
        await expect(getJournalItem(page, QUESTION_ONE)).toBeVisible();
        await expect(getJournalItem(page, QUESTION_ONE)).toContainText(COMPANY);
        await expect(page.getByRole('heading', { name: QUESTION_ONE })).toBeVisible();

        // reload to check it was saved, and the other question can still be added
        await page.reload();
        await waitForJournal(page);
        await expect(getJournalItem(page, QUESTION_ONE)).toBeVisible();

        await openCommunityModal(page);
        await expect(getCommunityCard(page, QUESTION_ONE).getByRole('button', { name: 'Added to journal' })).toBeDisabled();
        await expect(getCommunityCard(page, QUESTION_TWO).getByRole('button', { name: 'Add to journal' })).toBeEnabled();
    });

    // 3. Test Case Scenario: User logs in and clears a saved reflection using the confirmation popup
    test('user logs in and clears a saved reflection using the confirmation popup', async ({ page }) => {
        await getJournalItem(page, STARTER).click();
        const box = getReflectionBox(page);
        await box.fill(REFLECTION);
        await page.getByRole('button', { name: 'Save Response' }).click();
        await expect(page.getByText('Saved to your Interview Journal!')).toBeVisible();

        const dialog = page.getByRole('dialog');
        const clear = page.getByRole('button', { name: 'Clear', exact: true });

        // cancel keeps the reflection
        await clear.click();
        await expect(dialog.getByRole('heading', { name: 'Clear your reflection?' })).toBeVisible();
        await dialog.getByRole('button', { name: 'Cancel' }).click();
        await expect(dialog).toBeHidden();
        await expect(box).toHaveValue(REFLECTION);

        // confirming clears it
        await clear.click();
        await dialog.getByRole('button', { name: 'Clear' }).click();
        await expect(box).toHaveValue('');
        await expect(page.getByRole('button', { name: 'Save Response' })).toBeDisabled();

        // reload to check it stays cleared
        await page.reload();
        await waitForJournal(page);
        await getJournalItem(page, STARTER).click();
        await expect(getReflectionBox(page)).toHaveValue('');
    });

    // 4. Test Case Scenario: User logs in and removes a community question using the confirmation popup
    test('user logs in and removes a community question from the journal using the confirmation popup', async ({ page }) => {
        // this test visits two pages and cleans up both, so give it 3x the usual time
        test.slow();

        await shareQuestionsThenReturn(page);
        await addFromCommunity(page, QUESTION_ONE);
        const item = getJournalItem(page, QUESTION_ONE);
        const dialog = page.getByRole('dialog');

        // the added question is the selected one, so Remove applies to it
        const remove = page.getByRole('button', { name: 'Remove', exact: true });

        // cancel keeps the question
        await remove.click();
        await expect(dialog.getByRole('heading', { name: 'Remove this question?' })).toBeVisible();
        await dialog.getByRole('button', { name: 'Cancel' }).click();
        await expect(dialog).toBeHidden();
        await expect(item).toBeVisible();

        // confirming removes it
        await remove.click();
        await dialog.getByRole('button', { name: 'Remove' }).click();
        await expect(item).toHaveCount(0);

        // reload to check it stays removed, and the community popup offers it again
        await page.reload();
        await waitForJournal(page);
        await expect(item).toHaveCount(0);
        await openCommunityModal(page);
        await expect(getCommunityCard(page, QUESTION_ONE).getByRole('button', { name: 'Add to journal' })).toBeEnabled();
    });

    // 5. Test Case Scenario: User logs in and sees a loading spinner while the journal loads
    test('user logs in and sees a loading spinner instead of the empty state while the journal loads', async ({ page }) => {
        // slow the journal down so the loading state is easy to see
        await page.route('**/api/interview', async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            await route.continue();
        });
        await page.reload();

        await expect(page.getByText('Loading your interview journal...')).toBeVisible();
        await expect(page.getByText('No question selected')).toBeHidden();
        await expect(page.getByText('No practice questions in your journal yet')).toBeHidden();

        // the journal appears once the data arrives
        await waitForJournal(page);
        await expect(page.getByText('Loading your interview journal...')).toBeHidden();

        await page.unroute('**/api/interview');
    });

    // 6. Test Case Scenario: User logs in and tries to save or clear an empty reflection
    test('user logs in and cannot save or clear an empty reflection', async ({ page }) => {
        await getJournalItem(page, STARTER).click();
        const box = getReflectionBox(page);
        const save = page.getByRole('button', { name: 'Save Response' });
        const clear = page.getByRole('button', { name: 'Clear', exact: true });

        // start from an empty reflection
        await clearReflectionIfAny(page);

        // an empty box has nothing to save or clear
        await expect(save).toBeDisabled();
        await expect(clear).toBeDisabled();

        // only spaces don't count
        await box.fill('   ');
        await expect(save).toBeDisabled();
        await expect(clear).toBeDisabled();

        // real text unlocks both
        await box.fill('Some answer');
        await expect(save).toBeEnabled();
        await expect(clear).toBeEnabled();

        // once saved it can't be saved again until it changes
        await save.click();
        await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
        await box.fill('Some answer, edited');
        await expect(save).toBeEnabled();

        // the box has a 4000 character limit (typing 4000 keys is slow, so check the limit itself)
        await expect(box).toHaveAttribute('maxlength', '4000');
    });

    // 7. Test Case Scenario: User logs in and tries to add the same community question twice
    test('user logs in and cannot add the same community question twice', async ({ page }) => {
        // this test visits two pages and cleans up both, so give it 3x the usual time
        test.slow();

        await shareQuestionsThenReturn(page);
        await addFromCommunity(page, QUESTION_ONE);

        // the add button is locked, even if it is clicked anyway
        await openCommunityModal(page);
        const addedButton = getCommunityCard(page, QUESTION_ONE).getByRole('button', { name: 'Added to journal' });
        await expect(addedButton).toBeDisabled();
        await addedButton.click({ force: true });
        await page.getByRole('button', { name: 'Close modal' }).click();

        // there is still only the one copy in the journal
        await expect(getJournalItem(page, QUESTION_ONE)).toHaveCount(1);
    });
});
