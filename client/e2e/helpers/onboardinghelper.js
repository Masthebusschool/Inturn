import { expect } from '@playwright/test';
import { pageUrl, newEmail, signUp } from './authhelper';

// a brand new user, already logged in by sign up, waiting on the onboarding page
export async function newUserAtOnboarding(page) {
    const email = newEmail();
    await signUp(page, email);
    return email;
}

// picks an education level and moves on to the skills step
export async function chooseEducation(page, level = 'Undergraduate') {
    await page.getByText(level, { exact: true }).click();
    await page.getByRole('button', { name: 'Next' }).click();
}

// adds one skill on the skills step
export async function addSkill(page, skill) {
    await page.getByLabel('Your skills').fill(skill);
    await page.getByLabel('Your skills').press('Enter');
}

// walks to the resume step with: Undergraduate, skill Python, no industries
export async function goToResumeStep(page) {
    await chooseEducation(page);
    await addSkill(page, 'Python');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
}

// finishes onboarding without a resume
// (needed before the sidebar and its Log out button appear)
export async function completeOnboarding(page) {
    await goToResumeStep(page);
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page).toHaveURL(`${pageUrl}/jobs`);
}
