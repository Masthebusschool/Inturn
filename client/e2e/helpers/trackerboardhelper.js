import { expect } from '@playwright/test';

// column box with the heading e.g. "Saved (2)"
export function getColumn(page, status) {
    return page.locator('.card-inturn').filter({ has: page.getByRole('heading', { name: status }) });
}

// card that has both the company and job title
export function getCard(page, company, title) {
    return page.locator('.cursor-grab').filter({ hasText: company }).filter({ hasText: title });
}

// add a card from the column's + button (the form starts in that column)
export async function addCard(page, company, title, status, deadline = '2030-12-31') {
    await page.getByRole('button', { name: 'Add to ' + status }).click();
    await page.getByRole('textbox', { name: 'e.g. Software Engineer Intern' }).fill(title);
    await page.getByRole('textbox', { name: 'e.g. Grab' }).fill(company);
    await page.locator('input[type="date"]').fill(deadline);
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(getColumn(page, status).locator(getCard(page, company, title))).toBeVisible();
}

// add a task in the open checklist popup
export async function addTask(page, text) {
    await page.getByRole('textbox', { name: 'e.g. Research the company' }).fill(text);
    await page.getByRole('button', { name: 'Add Task', exact: true }).click();

    // wait until it's saved (the checkbox unlocks once the server gives the task an id)
    // the server can be slow to reply during a full run, so allow more than the default 5s
    await expect(page.getByRole('listitem').filter({ hasText: text }).getByRole('checkbox')).toBeEnabled({ timeout: 15000 });
}

// drag a card into another column
export async function moveCard(page, card, status) {
    await card.dragTo(getColumn(page, status));
}

// delete every matching card from its 3 dot menu (does nothing if there are none)
export async function deleteCard(page, company, title) {
    // wait for the board to load before checking for the card
    // loading the cards from the database can take well over the default 5s
    await expect(page.getByRole('heading', { name: 'Saved' })).toBeVisible({ timeout: 30000 });

    const cards = getCard(page, company, title);
    let remaining = await cards.count();

    while (remaining > 0) {
        const card = cards.first();
        await card.getByRole('button', { name: 'Card options' }).click();
        await card.getByRole('button', { name: 'Delete Card' }).click();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await expect(cards).toHaveCount(remaining - 1);
        remaining--;
    }
}
