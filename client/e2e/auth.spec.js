import { test, expect } from '@playwright/test';

// helpers
import {
    pageUrl,
    PASSWORD,
    newEmail,
    submitSignUp,
    signUp,
    signUpAndLogOut,
    logIn } from './helpers/authhelper';
import { completeOnboarding } from './helpers/onboardinghelper';

/* List of all scenarios tested under this file
    Sign up: good run scenarios
  1. User signs up and is logged in straight away, landing on onboarding

    Sign up: bad run scenarios
  2. User tries to sign up with an empty form
  3. User tries to sign up with an invalid email
  4. User tries to sign up with a password that is too short
  5. User tries to sign up with mismatched passwords
  6. User tries to sign up with an email that is already registered

    Log in: good run scenarios
  7. User who has not finished onboarding logs in and is sent back to onboarding
  8. Logged in user opens the login page and is redirected away
  9. Logged out user opens a protected page and is sent to the login page
  10. User logs out and returns to the login page

    Log in: bad run scenarios
  11. User tries to log in with a wrong password
  12. User tries to log in with an unknown email and sees the same error
  13. User tries to log in without an email and password
 */

test.describe('Sign up', () => {
    // 1. Test Case Scenario: User signs up and is logged in straight away, landing on onboarding
    test('should log the user in and go to onboarding after signing up', async ({ page }) => {
        await signUp(page, newEmail());

        await expect(page.getByRole('heading', { name: 'Complete your profile' })).toBeVisible();
    });

    // 2. Test Case Scenario: User tries to sign up with an empty form
    test('should show errors when the form is empty', async ({ page }) => {
        await page.goto(`${pageUrl}/signup`);
        await page.getByRole('button', { name: 'Sign up' }).click();

        await expect(page.getByText('Name is required')).toBeVisible();
        await expect(page.getByText('Email is required')).toBeVisible();
    });

    // 3. Test Case Scenario: User tries to sign up with an invalid email
    test('should reject an invalid email', async ({ page }) => {
        await submitSignUp(page, 'not-an-email');

        await expect(page.getByText('Email format is invalid')).toBeVisible();
    });

    // 4. Test Case Scenario: User tries to sign up with a password that is too short
    test('should reject a password that is too short', async ({ page }) => {
        await submitSignUp(page, newEmail(), 'Ab1');

        await expect(page.getByText('Password: at least 8 characters')).toBeVisible();
    });

    // 5. Test Case Scenario: User tries to sign up with mismatched passwords
    test('should reject mismatched passwords', async ({ page }) => {
        await submitSignUp(page, newEmail(), PASSWORD, 'Different123');

        await expect(page.getByText('Confirm password and password do not match')).toBeVisible();
    });

    // 6. Test Case Scenario: User tries to sign up with an email that is already registered
    test('should reject an email that is already registered', async ({ page }) => {
        const email = newEmail();

        // the first sign up logged us in, so log out before the second try
        await signUpAndLogOut(page, email);
        await submitSignUp(page, email);

        await expect(page.getByText('Email is already registered')).toBeVisible();
    });
});

test.describe('Log in', () => {
    // 7. Test Case Scenario: User who has not finished onboarding logs in and is sent back to onboarding
    test('should send a new user to onboarding after logging in', async ({ page }) => {
        const email = newEmail();
        await signUpAndLogOut(page, email);
        await logIn(page, email, PASSWORD);

        await expect(page).toHaveURL(`${pageUrl}/onboarding`);
        await expect(page.getByRole('heading', { name: 'Complete your profile' })).toBeVisible();
    });

    // 8. Test Case Scenario: Logged in user opens the login page and is redirected away
    test('should redirect a logged-in user away from the login page', async ({ page }) => {
        await signUp(page, newEmail());
        await page.goto(`${pageUrl}/login`);

        await expect(page).toHaveURL(`${pageUrl}/onboarding`);
    });

    // 9. Test Case Scenario: Logged out user opens a protected page and is sent to the login page
    test('should send a logged-out user to the login page', async ({ page }) => {
        await page.goto(`${pageUrl}/profile`);

        await expect(page).toHaveURL(/\/login/);
        await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    });

    // 10. Test Case Scenario: User logs out and returns to the login page
    test('should log out and return to the login page', async ({ page }) => {
        await signUp(page, newEmail());

        // finish onboarding first: the Log out button is in the sidebar, which onboarding does not show
        await completeOnboarding(page);

        await page.getByRole('button', { name: 'Log out' }).click();
        await expect(page).toHaveURL(`${pageUrl}/login`);
    });

    // 11. Test Case Scenario: User tries to log in with a wrong password
    test('should show an error for a wrong password', async ({ page }) => {
        const email = newEmail();
        await signUpAndLogOut(page, email);
        await logIn(page, email, 'WrongPass999');

        await expect(page.getByText('Email or password is incorrect')).toBeVisible();
    });

    // 12. Test Case Scenario: User tries to log in with an unknown email and sees the same error
    // (the same message as a wrong password, so the page does not reveal which emails have an account)
    test('should show the same error for an unknown email', async ({ page }) => {
        await logIn(page, newEmail(), PASSWORD);

        await expect(page.getByText('Email or password is incorrect')).toBeVisible();
    });

    // 13. Test Case Scenario: User tries to log in without an email and password
    test('should require email and password', async ({ page }) => {
        await page.goto(`${pageUrl}/login`);
        await page.getByRole('button', { name: 'Log in' }).click();

        await expect(page.getByText('Email is required')).toBeVisible();
        await expect(page.getByText('Password is required')).toBeVisible();
    });
});
