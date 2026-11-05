import { test, expect } from '@playwright/test';

// helpers
import { pageUrl, PASSWORD, newEmail, logIn } from './helpers/authhelper';
import {
    newUserAtOnboarding,
    chooseEducation,
    addSkill,
    goToResumeStep,
    completeOnboarding } from './helpers/onboardinghelper';
import {
    userAtProfile,
    userAtEditProfile,
    changeEmail,
    changePassword,
    openDeleteDialog } from './helpers/profilehelper';

/* List of all scenarios tested under this file
    Onboarding: good run scenarios
  1. User completes onboarding and goes to jobs
  2. User skips the resume step and goes to jobs

    Onboarding: bad run scenarios
  3. User tries to continue without an education level
  4. User tries to continue without a skill
  5. User tries to add the same skill twice

    Profile page: good run scenarios
  6. User sees their saved profile
  7. User saves a new name that persists

    Profile page: bad run scenarios
  8. User tries to save an empty name

    Change email: good run scenarios
  9. User changes their email and logs in with the new one

    Change email: bad run scenarios
  10. User tries to change their email with a wrong current password
  11. User tries to change their email to an invalid format

    Change password: good run scenarios
  12. User changes their password and logs in with the new one

    Change password: bad run scenarios
  13. User tries to change their password with a wrong current password
  14. User tries to set a new password that does not match the confirmation
  15. User tries to set the same password as the current one

    Delete profile: good run scenarios
  16. User deletes their account and can no longer log in
  17. User cancels out of the delete popup

    Delete profile: bad run scenarios
  18. User tries to delete their account before typing the matching email
 */

test.describe('Onboarding', () => {
    // every test starts as a new user on the onboarding page
    test.beforeEach(async ({ page }) => {
        await newUserAtOnboarding(page);
    });

    // 1. Test Case Scenario: User completes onboarding and goes to jobs
    test('should complete onboarding and go to jobs', async ({ page }) => {
        await completeOnboarding(page);
    });

    // 2. Test Case Scenario: User skips the resume step and goes to jobs
    test('should skip the resume step', async ({ page }) => {
        await goToResumeStep(page);
        await page.getByRole('button', { name: 'Skip for now' }).click();

        await expect(page).toHaveURL(`${pageUrl}/jobs`);
    });

    // 3. Test Case Scenario: User tries to continue without an education level
    test('should require an education level', async ({ page }) => {
        await page.getByRole('button', { name: 'Next' }).click();

        await expect(page.getByText('Please choose your education level')).toBeVisible();
    });

    // 4. Test Case Scenario: User tries to continue without a skill
    test('should require at least one skill', async ({ page }) => {
        await chooseEducation(page);
        await page.getByRole('button', { name: 'Next' }).click();

        await expect(page.getByText('Add at least one skill')).toBeVisible();
    });

    // 5. Test Case Scenario: User tries to add the same skill twice
    test('should not add the same skill twice', async ({ page }) => {
        await chooseEducation(page);
        await addSkill(page, 'Python');
        await addSkill(page, 'python');

        await expect(page.getByText('"python" is already added')).toBeVisible();
    });
});

test.describe('Profile page', () => {
    // 6. Test Case Scenario: User sees their saved profile
    test('should show the saved profile', async ({ page }) => {
        const email = await userAtProfile(page);

        await expect(page.getByRole('heading', { name: 'E2E User' })).toBeVisible();
        await expect(page.getByText(email, { exact: true })).toBeVisible();
        await expect(page.getByText('Undergraduate', { exact: true })).toBeVisible();
        await expect(page.getByText('Python')).toBeVisible();
    });

    // 7. Test Case Scenario: User saves a new name that persists
    test('should save a new name from edit profile', async ({ page }) => {
        await userAtEditProfile(page);
        await page.getByLabel('Name', { exact: true }).fill('Renamed User');
        await page.getByRole('button', { name: 'Save details' }).click();
        await expect(page.getByText('Profile updated')).toBeVisible();

        // full page load, so the new name has to come from the server, not from memory
        await page.goto(`${pageUrl}/profile`);
        await expect(page.getByRole('heading', { name: 'Renamed User' })).toBeVisible();
    });

    // 8. Test Case Scenario: User tries to save an empty name
    test('should require a name on edit profile', async ({ page }) => {
        await userAtEditProfile(page);
        await page.getByLabel('Name', { exact: true }).fill('');
        await page.getByRole('button', { name: 'Save details' }).click();

        await expect(page.getByText('Name is required')).toBeVisible();
    });
});

test.describe('Change email', () => {
    // every test starts on the edit profile page
    test.beforeEach(async ({ page }) => {
        await userAtEditProfile(page);
    });

    // 9. Test Case Scenario: User changes their email and logs in with the new one
    test('should change the email and log in with the new one', async ({ page }) => {
        const next = newEmail();
        await changeEmail(page, next, PASSWORD);

        await expect(page.getByText('Email updated')).toBeVisible();
        await expect(page.getByText(next, { exact: true })).toBeVisible();

        await page.getByRole('button', { name: 'Log out' }).click();
        await logIn(page, next, PASSWORD);
        await expect(page).toHaveURL(`${pageUrl}/jobs`);
    });

    // 10. Test Case Scenario: User tries to change their email with a wrong current password
    test('should reject a wrong current password', async ({ page }) => {
        await changeEmail(page, newEmail(), 'Wrong123pass');

        await expect(page.getByText('Current password is incorrect')).toBeVisible();
    });

    // 11. Test Case Scenario: User tries to change their email to an invalid format
    test('should reject an invalid email format', async ({ page }) => {
        await changeEmail(page, 'not-an-email', PASSWORD);

        await expect(page.getByText('Email format is invalid')).toBeVisible();
    });
});

test.describe('Change password', () => {
    const NEW_PASSWORD = 'NewPassw0rd456';

    // 12. Test Case Scenario: User changes their password and logs in with the new one
    test('should change the password and log in with it', async ({ page }) => {
        const email = await userAtEditProfile(page);
        await changePassword(page, PASSWORD, NEW_PASSWORD, NEW_PASSWORD);
        await expect(page.getByText('Password updated')).toBeVisible();

        await page.getByRole('button', { name: 'Log out' }).click();

        // the old password no longer works
        await logIn(page, email, PASSWORD);
        await expect(page.getByText('Email or password is incorrect')).toBeVisible();

        await logIn(page, email, NEW_PASSWORD);
        await expect(page).toHaveURL(`${pageUrl}/jobs`);
    });

    // 13. Test Case Scenario: User tries to change their password with a wrong current password
    test('should reject a wrong current password', async ({ page }) => {
        await userAtEditProfile(page);
        await changePassword(page, 'Wrong123pass', NEW_PASSWORD, NEW_PASSWORD);

        await expect(page.getByText('Current password is incorrect')).toBeVisible();
    });

    // 14. Test Case Scenario: User tries to set a new password that does not match the confirmation
    test('should reject a new password that does not match the confirmation', async ({ page }) => {
        await userAtEditProfile(page);
        await changePassword(page, PASSWORD, NEW_PASSWORD, 'Different789');

        await expect(page.getByText('Confirm password and password do not match')).toBeVisible();
    });

    // 15. Test Case Scenario: User tries to set the same password as the current one
    test('should reject the same password as the current one', async ({ page }) => {
        await userAtEditProfile(page);
        await changePassword(page, PASSWORD, PASSWORD, PASSWORD);

        await expect(page.getByText('New password must be different from your current password')).toBeVisible();
    });
});

test.describe('Delete profile', () => {
    // 16. Test Case Scenario: User deletes their account and can no longer log in
    test('should delete the account and block logging in again', async ({ page }) => {
        const email = await userAtProfile(page);
        await openDeleteDialog(page);
        await page.getByLabel('Type your email').fill(email);
        await page.getByRole('button', { name: 'Permanently delete' }).click();
        await expect(page).toHaveURL(`${pageUrl}/login`);

        await logIn(page, email, PASSWORD);
        await expect(page.getByText('Email or password is incorrect')).toBeVisible();
    });

    // 17. Test Case Scenario: User cancels out of the delete popup
    test('should close the delete dialog on cancel', async ({ page }) => {
        await userAtProfile(page);
        await openDeleteDialog(page);

        await page.getByRole('button', { name: 'Cancel' }).click();
        await expect(page.getByRole('heading', { name: 'Delete your profile?' })).toBeHidden();
        await expect(page).toHaveURL(`${pageUrl}/profile`);
    });

    // 18. Test Case Scenario: User tries to delete their account before typing the matching email
    test('should keep delete disabled until the email matches', async ({ page }) => {
        const email = await userAtProfile(page);
        await openDeleteDialog(page);

        await expect(page.getByRole('button', { name: 'Permanently delete' })).toBeDisabled();
        await page.getByLabel('Type your email').fill('wrong@inturn.test');
        await expect(page.getByRole('button', { name: 'Permanently delete' })).toBeDisabled();
        await page.getByLabel('Type your email').fill(email);
        await expect(page.getByRole('button', { name: 'Permanently delete' })).toBeEnabled();
    });
});
