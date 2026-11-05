import { expect } from '@playwright/test';
import { pageUrl } from './authhelper';
import { newUserAtOnboarding, completeOnboarding } from './onboardinghelper';

// a user who has finished onboarding, now on the profile page
export async function userAtProfile(page) {
    const email = await newUserAtOnboarding(page);
    await completeOnboarding(page);
    await page.goto(`${pageUrl}/profile`);
    await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible();
    return email;
}

// a user who has finished onboarding, now on the edit profile page
export async function userAtEditProfile(page) {
    const email = await userAtProfile(page);
    await page.getByRole('button', { name: 'Edit profile' }).click();
    await expect(page.getByRole('heading', { name: 'Edit profile', exact: true })).toBeVisible();
    return email;
}

// fills in the change email form and submits it
export async function changeEmail(page, email, currentPassword) {
    await page.getByLabel('New email').fill(email);
    await page.locator('#edit-email-password').fill(currentPassword);
    await page.getByRole('button', { name: 'Change email' }).click();
}

// fills in the change password form and submits it
export async function changePassword(page, current, next, confirm) {
    await page.locator('#edit-pw-current').fill(current);
    await page.getByLabel('New password', { exact: true }).fill(next);
    await page.getByLabel('Confirm new password').fill(confirm);
    await page.getByRole('button', { name: 'Change password' }).click();
}

// opens the delete profile popup
export async function openDeleteDialog(page) {
    await page.getByRole('button', { name: 'Delete profile…' }).click();
    await expect(page.getByRole('heading', { name: 'Delete your profile?' })).toBeVisible();
}
