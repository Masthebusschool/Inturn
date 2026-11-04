import { expect } from '@playwright/test';

const pageUrl = 'http://localhost:5173';

export async function loginTestUser(page, email, password) {
    await page.goto(pageUrl);
    await page.getByRole('textbox', { name: 'Email address' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();

    // the side nav only shows once the user is logged in
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeAttached();
}
