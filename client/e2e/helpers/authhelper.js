import { expect } from '@playwright/test';

export const pageUrl = 'http://localhost:5173';

// the password every new test account signs up with
export const PASSWORD = 'Passw0rd123';

// a different email every time, so the tests can be run again and again
export function newEmail() {
    return `e2e-${Date.now()}-${Math.floor(Math.random() * 100000)}@inturn.test`;
}

// fills in the sign up form and submits it, without checking the result
// (the bad run tests use this directly to reach the error messages)
export async function submitSignUp(page, email, password = PASSWORD, confirm = password) {
    await page.goto(`${pageUrl}/signup`);
    await page.getByLabel('Name', { exact: true }).fill('E2E User');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(confirm);
    await page.getByRole('button', { name: 'Sign up' }).click();
}

// creates an account through the sign up form
// (sign up starts a session, so the user is already logged in and lands on onboarding)
export async function signUp(page, email) {
    await submitSignUp(page, email);
    await expect(page).toHaveURL(`${pageUrl}/onboarding`);
}

// an account that exists but is NOT logged in
// (a logged in user is redirected away from /login and /signup, so drop the session cookie;
// onboarding has no sidebar, so there is no Log out button to click yet)
export async function signUpAndLogOut(page, email) {
    await signUp(page, email);
    await page.context().clearCookies();
}

// submits the login form, without checking the result
// (loginTestUser in loginhelper waits for the side nav, which never shows
// for a failed login or for a user who has not finished onboarding)
export async function logIn(page, email, password) {
    await page.goto(`${pageUrl}/login`);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();
}
