import { expect } from '@playwright/test';

// waits until the Interview Intel page has finished loading its posts
// (the page title only shows once the loading spinner is gone, which can take
// a few seconds the first time the page opens, so allow up to 15 seconds)
export async function waitForFeed(page) {
    await expect(page.getByRole('heading', { name: 'Interview Intel', level: 1 })).toBeVisible({ timeout: 15000 });
}

// all the post cards on the feed for one company
export function getPost(page, company) {
    return page.locator('article').filter({ hasText: company });
}

// opens the "Share interview intel" form
export async function openShareForm(page) {
    await page.getByRole('button', { name: 'Share your experience' }).first().click();
    await expect(page.getByRole('heading', { name: 'Share interview intel' })).toBeVisible();
}

// fills in the form and publishes a post
// type is 'Experience' (uses body) or 'Interview questions' (uses the questions list)
export async function publishPost(page, { type, company, role = 'QA Intern', title = 'E2E test post', body = '', questions = [] }) {
    await openShareForm(page);
    await page.locator('#post-type').selectOption(type);
    await page.locator('#post-company').fill(company);
    await page.locator('#post-role').fill(role);
    await page.locator('#post-title').fill(title);

    if (type === 'Experience') {
        await page.locator('#post-body').fill(body);
    } else {
        const boxes = page.getByPlaceholder('Type one question');
        for (let i = 0; i < questions.length; i++) {
            if (i > 0) {
                await page.getByRole('button', { name: 'Add another question' }).click();
            }
            await boxes.nth(i).fill(questions[i]);
        }
    }

    await page.getByRole('button', { name: 'Publish post' }).click();
    await expect(getPost(page, company).first()).toBeVisible();
}

// deletes every post for a company using the delete popup
// (also cleans up any posts left behind by a failed run)
export async function deletePost(page, company) {
    const posts = getPost(page, company);
    let count = await posts.count();

    while (count > 0) {
        await posts.first().getByTitle('Delete your post').click();
        await page.getByRole('dialog').getByRole('button', { name: 'Delete post' }).click();
        await expect(posts).toHaveCount(count - 1);
        count--;
    }
}

// the dropdown box that holds a filter (the search input inside it is 0px wide
// while the dropdown is closed, so Playwright can only click the box itself)
function getFilterBox(page, filterId) {
    return page.locator('.multiselect').filter({ has: page.locator('#' + filterId) });
}

// picks a value in the Post type filter (a dropdown without a search box)
export async function setTypeFilter(page, type) {
    // the Post type filter is the first dropdown on the page
    const box = page.locator('.multiselect').first();
    await box.click();
    await box.locator('.multiselect__option').filter({ hasText: type }).first().click();
}

// picks a company in the Company filter by typing its name
export async function setCompanyFilter(page, company) {
    const box = getFilterBox(page, 'filter-company');

    // open the dropdown first, then type to narrow the list down
    await box.click();
    await page.keyboard.type(company);
    await box.locator('.multiselect__option').filter({ hasText: company }).first().click();
}