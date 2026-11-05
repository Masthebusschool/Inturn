import { test, expect } from '@playwright/test';

// helpers
import { loginTestUser } from './helpers/loginhelper.js';

/* List of all scenarios tested under this file
    Good run scenarios
  1. User searches for internships and sees the returned results
  2. User adds and removes a custom skill filter

    Bad run scenarios
  3. User searches for a keyword with no matches
  4. User enters an invalid monthly pay range and corrects it
  5. User retries after a failed search request
 */

// disclaimer: unable to do internship-related testing as interships refreshes everyday 
// due to a scheduled sync to update live internships, thus it may change and test may fail if
// listing expires.

const jobCards = (page) => page.locator('.job-card');

const emptyHeading = (page) =>
    page.getByRole('heading', {
        name: 'No matching internships',
        exact: true,
    });

const errorHeading = (page) =>
    page.getByRole('heading', {
        name: 'Unable to load internships',
        exact: true,
    });

const showResults = (page) =>
    page.getByRole('button', { name: 'Show All Results', exact: true });

const isSearchUrl = (url) => url.pathname.endsWith('/jobs/search');

async function waitForSearchAction(page, action) {
    const [response] = await Promise.all([
        page.waitForResponse(
            (response) =>
                isSearchUrl(new URL(response.url())) &&
                response.request().method() === 'POST'
        ),
        action(),
    ]);

    return response;
}

async function search(page, keyword) {
    await page.getByLabel('Search Internships').fill(keyword);

    return waitForSearchAction(page, () =>
        page.getByRole('button', { name: 'Search', exact: true }).click()
    );
}

async function openFilters(page) {
    await page.getByRole('button', { name: /^Filters\b/ }).click();

    await expect(
        page.getByRole('heading', { name: 'Filter Internships', exact: true })
    ).toBeVisible();
}

test.describe('Job Search', () => {
    // Every test starts logged in on the Jobs page.
    test.beforeEach(async ({ page }) => {
        await loginTestUser(page, 'char@gmail.com', 'Ab123456', { waitForNav: false });
        
        await expect(page).toHaveURL(/\/jobs(?:[/?#]|$)/, { timeout: 60_000 });

        await expect(
            page.getByLabel('Search Internships')
        ).toBeEnabled({ timeout: 60_000 });
    });

    // 1. Test Case Scenario: User searches for internships and sees the returned results
    test('searches for internships and displays the returned results', async ({ page }) => {
        const response = await search(page, 'intern');
        expect(response.ok()).toBe(true);

        const { results, total } = await response.json();

        expect(total).toBeGreaterThan(0);
        expect(results.length).toBeGreaterThan(0);
        expect(results.length).toBeLessThanOrEqual(10);

        await expect(jobCards(page)).toHaveCount(results.length);
        await expect(
            jobCards(page).first().locator('.job-title-button')
        ).toHaveText(results[0].title);
    });

    // 2. Test Case Scenario: User adds and removes a custom skill filter
    test('adds and removes a custom skill filter', async ({ page }) => {
        const skill = 'E2E Unlisted Skill 987654321';

        await openFilters(page);
        await page.getByLabel('Find or add a skill').fill(skill);
        await page.getByRole('button', { name: 'Add skill', exact: true }).click();
        await showResults(page).click();

        const chip = page.getByRole('button', {
            name: `Remove filter: ${skill}`,
            exact: true,
        });

        await expect(chip).toHaveCount(1);
        await expect(emptyHeading(page)).toBeVisible();

        await chip.click();

        await expect(chip).toHaveCount(0);
        await expect(jobCards(page).first()).toBeVisible();
    });

    // 3. Test Case Scenario: User searches for a keyword with no matches
    test('shows the empty state for a keyword with no matches', async ({ page }) => {
        const response = await search(page, 'e2e-no-such-internship-987654321');

        expect(response.ok()).toBe(true);
        expect((await response.json()).total).toBe(0);

        await expect(emptyHeading(page)).toBeVisible();
        await expect(jobCards(page)).toHaveCount(0);
    });

    // 4. Test Case Scenario: User enters an invalid monthly pay range and corrects it
    test('rejects an invalid monthly pay range until corrected', async ({ page }) => {
        await openFilters(page);

        await page.getByLabel('Minimum monthly pay').fill('5000');
        await page.getByLabel('Maximum monthly pay').fill('1000');

        const payError = page.getByRole('alert').filter({
            hasText: 'Minimum pay cannot exceed maximum pay.',
        });

        await expect(payError).toBeVisible();
        await expect(showResults(page)).toBeDisabled();

        await page.getByLabel('Maximum monthly pay').fill('6000');

        await expect(payError).toHaveCount(0);
        await expect(showResults(page)).toBeEnabled();
    });

    // 5. Test Case Scenario: User retries after a failed search request
    test('shows a search error and recovers when the user retries', async ({ page }) => {
        const failSearch = async (route) => {
            if (route.request().method() !== 'POST') {
                await route.fallback();
                return;
            }

            await route.fulfill({
                status: 503,
                json: { message: 'Simulated search failure' },
            });
        };

        await page.route(isSearchUrl, failSearch);

        const failedResponse = await search(page, 'intern');
        expect(failedResponse.status()).toBe(503);

        await expect(errorHeading(page)).toBeVisible();
        await expect(emptyHeading(page)).toHaveCount(0);

        await page.unroute(isSearchUrl, failSearch);

        const retryResponse = await waitForSearchAction(page, () =>
            page.getByRole('button', { name: 'Try again', exact: true }).click()
        );

        expect(retryResponse.ok()).toBe(true);
        await expect(errorHeading(page)).toHaveCount(0);
        await expect(jobCards(page).first()).toBeVisible();
    });
});