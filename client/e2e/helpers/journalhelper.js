import { expect } from '@playwright/test';

// waits until the Interview Journal has finished loading
// (the journal title only shows once the loading spinner is gone, which can take
// a few seconds the first time the page opens, so allow up to 15 seconds)
export async function waitForJournal(page) {
    await expect(page.getByRole('heading', { name: /Interview Journal/ })).toBeVisible({ timeout: 15000 });
}

// a question in the journal list on the left
export function getJournalItem(page, text) {
    return page.locator('.list-group button').filter({ hasText: text });
}

// the reflection box for the selected question
export function getReflectionBox(page) {
    return page.getByRole('textbox', { name: 'Your Reflection' });
}

// opens the community questions popup
export async function openCommunityModal(page) {
    await page.getByRole('button', { name: /Browse questions from Interview Intel/ }).click();
    await expect(page.getByRole('heading', { name: 'Community interview questions' })).toBeVisible();
}

// the card in the community popup that holds a given question
export function getCommunityCard(page, questionText) {
    return page
        .getByRole('dialog')
        .getByRole('heading', { name: questionText })
        .first()
        .locator('xpath=ancestor::div[contains(@class, "card")][1]');
}

// adds a community question to the journal, then closes the popup
export async function addFromCommunity(page, questionText) {
    await openCommunityModal(page);
    const card = getCommunityCard(page, questionText);
    await card.getByRole('button', { name: 'Add to journal' }).click();
    await expect(card.getByRole('button', { name: 'Added to journal' })).toBeVisible();
    await page.getByRole('button', { name: 'Close modal' }).click();
}

// removes every journal question that contains the text, using the remove popup
// (also cleans up any questions left behind by a failed run)
export async function removeQuestions(page, text) {
    const items = getJournalItem(page, text);
    let count = await items.count();

    while (count > 0) {
        await items.first().click();
        await page.getByRole('button', { name: 'Remove', exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
        await expect(items).toHaveCount(count - 1);
        count--;
    }
}

// clears the reflection on the selected question, if it has one
export async function clearReflectionIfAny(page) {
    const clear = page.getByRole('button', { name: 'Clear', exact: true });
    if (await clear.count() === 0 || await clear.isDisabled()) {
        return;
    }
    await clear.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Clear' }).click();
    await expect(getReflectionBox(page)).toHaveValue('');
}