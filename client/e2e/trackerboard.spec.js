import { test, expect } from '@playwright/test';

// helpers
import { goToNav } from './helpers/navhelper';
import { loginTestUser } from './helpers/loginhelper';
import { 
    getColumn, 
    getCard, 
    addCard, 
    addTask, 
    moveCard, 
    deleteCard } from './helpers/trackerboardhelper';

/* List of all scenarios tested under this file
    Good run scenarios
  1. User logs in and adds a new card under Applied with a few checklist items
  2. User logs in and moves a card through all app status pipeline
  3. User logs in and adds a saved card with skills, then filters the board by favourites
  4. User logs in and adds a saved card with skills, then filters the board by search
  5. User logs in and adds a saved card with skills, then filters the board by search, favourite then sort

    Bad run scenarios
  6. User logs in and tries to add cards with missing, wrong and duplicate details
  7. User logs in and tries to edit a card with missing, wrong and duplicate details
  8. User logs in and tries to add empty checklist tasks
  9. User logs in and tries to add a lot of checklist tasks, including duplicates repeatedly
 */

test.describe('Tracker Board', () => {
    // all tests share one account and the same card names, so run them one at a time
    test.describe.configure({ mode: 'default' });

    // every test starts logged in on the tracker board
    test.beforeEach(async ({ page }) => {
        await loginTestUser(page, 'samt@gmail.com', 'Qwertyuiop1');

        // bridge portion to reach tracker board:
        await goToNav(page, 'Tracker Board');

        // clear leftovers from an earlier interrupted/failed run so the duplicate check doesn't trip
        await deleteCard(page, 'Grab', 'Software Intern');
        await deleteCard(page, 'DBS', 'Software Intern');
    });

    // remove the test cards so the next run can add them again (avoids the duplicate check)
    test.afterEach(async ({ page }) => {
        // reload first so a popup left open by a failed test doesn't block the menu
        await page.reload();
        await deleteCard(page, 'Grab', 'Software Intern');
        await deleteCard(page, 'DBS', 'Software Intern');
    });

    // 1. Test Case Scenario: User logs in and adds a card with a few checklist items for a newly applied job application
    test('user logs in and adds an applied card with checklist items that persist', async ({ page }) => {
        await addCard(page, 'Grab', 'Software Intern', 'Applied');
        const card = getCard(page, 'Grab', 'Software Intern');

        // no skills were given, so the card says so instead of 0/0
        await expect(card).toContainText('No skills listed');

        // open the checklist from the card's 3 dot menu
        await card.getByRole('button', { name: 'Card options' }).click();
        await card.getByRole('button', { name: 'Checklist' }).click();

        // add 3 tasks
        await addTask(page, 'Research the company');
        await addTask(page, 'Tailor resume');
        await addTask(page, 'Prepare STAR stories');

        // tick off the first task
        const firstTask = page.getByRole('listitem').filter({ hasText: 'Research the company' }).getByRole('checkbox');
        await firstTask.check();
        await expect(firstTask).toBeChecked();

        await page.getByRole('button', { name: 'Done' }).click();
        await expect(card).toContainText('1 / 3 Prep');

        // reload to check the card and its checklist were saved
        await page.reload();
        await expect(getColumn(page, 'Applied').locator(card)).toBeVisible();
        await expect(card).toContainText('1 / 3 Prep');
    });

    // 2. Test Case Scenario: User logs in and moves a card through the whole status pipeline
    test('user logs in and card moves through status pipeline and persists', async ({ page }) => {
        await addCard(page, 'Grab', 'Software Intern', 'Saved');
        const card = getCard(page, 'Grab', 'Software Intern');

        await moveCard(page, card, 'Applied');
        await expect(getColumn(page, 'Applied').locator(card)).toBeVisible();

        // moving to Interview opens the interview date prompt
        await moveCard(page, card, 'Interview');
        await page.getByRole('button', { name: 'Skip for now' }).click();
        await expect(getColumn(page, 'Interview').locator(card)).toBeVisible();

        await moveCard(page, card, 'Offered');
        await expect(getColumn(page, 'Offered').locator(card)).toBeVisible();

        // reload to check the final status was saved
        await page.reload();
        await expect(getColumn(page, 'Offered').locator(card)).toBeVisible();
        // end of the pipeline
    });

    // 3. Test Case Scenario: User logs in, adds a saved card with skills, and filters the board by favourites
    test('user logs in and adds a saved card with skills then filters by favourites', async ({ page }) => {
        await page.getByRole('button', { name: 'Add to Saved' }).click();
        await page.getByRole('textbox', { name: 'e.g. Software Engineer Intern' }).fill('Software Intern');
        await page.getByRole('textbox', { name: 'e.g. Grab' }).fill('DBS');
        await page.locator('input[type="date"]').fill('2030-12-31');
        await page.getByRole('textbox', { name: 'Python, SQL, Git' }).fill('Python, Tableau, Java, C++');
        await page.getByRole('button', { name: 'Add', exact: true }).click();

        const card = getCard(page, 'DBS', 'Software Intern');
        await expect(getColumn(page, 'Saved').locator(card)).toBeVisible();

        // all 4 skills are counted on the card
        await expect(card).toContainText('/4 Skills Matched');

        // open the missing skills list
        const missingSkills = card.getByRole('button', { name: 'View Missing Skills' });
        await missingSkills.click();
        await expect(missingSkills).toHaveAttribute('aria-expanded', 'true');

        // the new card isn't a favourite, so the favourites filter hides it
        await page.getByRole('button', { name: '★ Favourites' }).click();
        await expect(card).toBeHidden();

        // reset brings it back
        await page.getByRole('button', { name: '↺ Reset' }).click();
        await expect(card).toBeVisible();
    });

    // 4. Test Case Scenario: User logs in, adds a saved card with skills, and filters the board by search
    test('user logs in and adds a saved card with skills then filters by search', async ({ page }) => {
        await addCard(page, 'Grab', 'Software Intern', 'Saved');

        await page.getByRole('button', { name: 'Add to Saved' }).click();
        await page.getByRole('textbox', { name: 'e.g. Software Engineer Intern' }).fill('Software Intern');
        await page.getByRole('textbox', { name: 'e.g. Grab' }).fill('DBS');
        await page.locator('input[type="date"]').fill('2030-12-31');
        await page.getByRole('textbox', { name: 'Python, SQL, Git' }).fill('Python, Tableau, Java, C++');
        await page.getByRole('button', { name: 'Add', exact: true }).click();

        const grabCard = getCard(page, 'Grab', 'Software Intern');
        const dbsCard = getCard(page, 'DBS', 'Software Intern');
        const search = page.getByRole('searchbox', { name: 'Search title or company' });

        // search by company (any capitals) shows only that card
        await search.fill('dbs');
        await expect(dbsCard).toBeVisible();
        await expect(grabCard).toBeHidden();

        // search by job title shows both
        await search.fill('software intern');
        await expect(dbsCard).toBeVisible();
        await expect(grabCard).toBeVisible();

        // no match hides both
        await search.fill('no such job');
        await expect(dbsCard).toBeHidden();
        await expect(grabCard).toBeHidden();

        // reset clears the search and brings them back
        await page.getByRole('button', { name: '↺ Reset' }).click();
        await expect(search).toHaveValue('');
        await expect(dbsCard).toBeVisible();
        await expect(grabCard).toBeVisible();
    });

    // 5. Test Case Scenario: User logs in, adds a saved card with skills, and filters the board by search, favourite then sort
    test('user logs in and adds a saved card with skills then filters by search, favourite and sort', async ({ page }) => {
        // Grab is due first, DBS is added last
        await addCard(page, 'Grab', 'Software Intern', 'Saved', '2030-06-30');

        await page.getByRole('button', { name: 'Add to Saved' }).click();
        await page.getByRole('textbox', { name: 'e.g. Software Engineer Intern' }).fill('Software Intern');
        await page.getByRole('textbox', { name: 'e.g. Grab' }).fill('DBS');
        await page.locator('input[type="date"]').fill('2030-12-31');
        await page.getByRole('textbox', { name: 'Python, SQL, Git' }).fill('Python, Tableau, Java, C++');
        await page.getByRole('button', { name: 'Add', exact: true }).click();

        const grabCard = getCard(page, 'Grab', 'Software Intern');
        const dbsCard = getCard(page, 'DBS', 'Software Intern');
        await expect(dbsCard).toBeVisible();

        // make the Grab card a favourite from its 3 dot menu
        await grabCard.getByRole('button', { name: 'Card options' }).click();
        await grabCard.getByRole('button', { name: 'Favourite' }).click();
        await expect(grabCard).toContainText('★');

        // search so only the two test cards are on the board
        await page.getByRole('searchbox', { name: 'Search title or company' }).fill('software intern');
        await expect(grabCard).toBeVisible();
        await expect(dbsCard).toBeVisible();

        // favourites on top of the search shows only Grab
        await page.getByRole('button', { name: '★ Favourites' }).click();
        await expect(grabCard).toBeVisible();
        await expect(dbsCard).toBeHidden();

        // favourites off again
        await page.getByRole('button', { name: '★ Favourites' }).click();
        await expect(dbsCard).toBeVisible();

        // soonest deadline first puts Grab on top
        const savedCards = getColumn(page, 'Saved').locator('.cursor-grab');
        const sort = page.getByRole('combobox', { name: 'Sort applications' });
        await sort.selectOption('deadline');
        await expect(savedCards.nth(0)).toContainText('Grab');
        await expect(savedCards.nth(1)).toContainText('DBS');

        // latest saved first puts DBS on top
        await sort.selectOption('latest');
        await expect(savedCards.nth(0)).toContainText('DBS');
        await expect(savedCards.nth(1)).toContainText('Grab');

        // reset puts the search and sort back to how they start
        await page.getByRole('button', { name: '↺ Reset' }).click();
        await expect(page.getByRole('searchbox', { name: 'Search title or company' })).toHaveValue('');
        await expect(sort).toHaveValue('default');
    });

    // 6. Test Case Scenario: User logs in and tries to add cards with missing, wrong and duplicate details
    test('user logs in and the add form rejects missing, wrong and duplicate details', async ({ page }) => {
        await page.getByRole('button', { name: 'Add to Saved' }).click();

        // submit with nothing filled in
        await page.getByRole('button', { name: 'Add', exact: true }).click();
        await expect(page.getByText('Please enter the internship title.')).toBeVisible();
        await expect(page.getByText('Please enter the company name.')).toBeVisible();
        await expect(page.getByText('Please pick the application deadline.')).toBeVisible();

        // a past deadline and a link without http
        await page.getByRole('textbox', { name: 'e.g. Software Engineer Intern' }).fill('Software Intern');
        await page.getByRole('textbox', { name: 'e.g. Grab' }).fill('Grab');
        await page.locator('input[type="date"]').fill('2020-01-01');
        await page.getByRole('textbox', { name: 'https://...' }).fill('grab.com/careers');
        await page.getByRole('button', { name: 'Add', exact: true }).click();
        await expect(page.getByText("The deadline can't be in the past.")).toBeVisible();
        await expect(page.getByText('Link must start with http:// or https://')).toBeVisible();

        // fix both, then the card is added
        await page.locator('input[type="date"]').fill('2030-12-31');
        await page.getByRole('textbox', { name: 'https://...' }).fill('https://grab.com/careers');
        await page.getByRole('button', { name: 'Add', exact: true }).click();
        const card = getCard(page, 'Grab', 'Software Intern');
        await expect(getColumn(page, 'Saved').locator(card)).toBeVisible();

        // the same job again (in different capitals) counts as a duplicate
        await page.getByRole('button', { name: 'Add to Applied' }).click();
        await page.getByRole('textbox', { name: 'e.g. Software Engineer Intern' }).fill('software intern');
        await page.getByRole('textbox', { name: 'e.g. Grab' }).fill('grab');
        await page.locator('input[type="date"]').fill('2030-12-31');
        await page.getByRole('button', { name: 'Add', exact: true }).click();
        await expect(page.getByText('You already have this application on your board.')).toBeVisible();

        // cancel, and there's still only the one card
        await page.getByRole('button', { name: 'Cancel' }).click();
        await expect(card).toHaveCount(1);
    });

    // 7. Test Case Scenario: User logs in and tries to edit a card with missing, wrong and duplicate details
    test('user logs in and the edit form rejects missing, wrong and duplicate details', async ({ page }) => {
        await addCard(page, 'Grab', 'Software Intern', 'Saved');
        await addCard(page, 'DBS', 'Software Intern', 'Saved');
        const card = getCard(page, 'Grab', 'Software Intern');

        // open the edit form from the card's 3 dot menu
        await card.getByRole('button', { name: 'Card options' }).click();
        await card.getByRole('button', { name: 'Edit Card' }).click();
        await expect(page.getByRole('heading', { name: 'Edit Application' })).toBeVisible();

        // clear the title and use a link without http
        await page.getByRole('textbox', { name: 'e.g. Software Engineer Intern' }).fill('');
        await page.getByRole('textbox', { name: 'https://...' }).fill('grab.com/careers');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByText('Please enter the internship title.')).toBeVisible();
        await expect(page.getByText('Link must start with http:// or https://')).toBeVisible();

        // renaming it to match the DBS card counts as a duplicate
        await page.getByRole('textbox', { name: 'e.g. Software Engineer Intern' }).fill('Software Intern');
        await page.getByRole('textbox', { name: 'e.g. Grab' }).fill('DBS');
        await page.getByRole('textbox', { name: 'https://...' }).fill('');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByText('You already have this application on your board.')).toBeVisible();

        // cancel, and the Grab card is unchanged
        await page.getByRole('button', { name: 'Cancel' }).click();
        await expect(card).toBeVisible();

        // a valid edit saves (the card now links to the job posting)
        await card.getByRole('button', { name: 'Card options' }).click();
        await card.getByRole('button', { name: 'Edit Card' }).click();
        await page.getByRole('textbox', { name: 'https://...' }).fill('https://grab.com/careers');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(card.getByRole('link', { name: /View/ })).toHaveAttribute('href', 'https://grab.com/careers');
    });

    // 8. Test Case Scenario: User logs in and tries to add empty checklist tasks
    test('user logs in and the checklist ignores empty tasks', async ({ page }) => {
        await addCard(page, 'Grab', 'Software Intern', 'Saved');
        const card = getCard(page, 'Grab', 'Software Intern');

        // open the checklist from the card's 3 dot menu
        await card.getByRole('button', { name: 'Card options' }).click();
        await card.getByRole('button', { name: 'Checklist' }).click();

        // add with an empty box, then with only spaces
        await page.getByRole('button', { name: 'Add Task', exact: true }).click();
        await page.getByRole('textbox', { name: 'e.g. Research the company' }).fill('   ');
        await page.getByRole('button', { name: 'Add Task', exact: true }).click();

        // neither one is added
        await expect(page.getByText('No tasks yet. Add one below.')).toBeVisible();

        // a real task is still added after that
        await addTask(page, 'Research the company');
        await expect(page.getByText('No tasks yet. Add one below.')).toBeHidden();

        await page.getByRole('button', { name: 'Done' }).click();
        await expect(card).toContainText('0 / 1 Prep');
    });

    // 9. Test Case Scenario: User logs in and tries to add a lot of checklist tasks, including duplicates repeatedly
    test('user logs in and the checklist blocks duplicates and stops at 15 tasks', async ({ page }) => {
        // 15 saves to the cloud database can take a while (one slow reply can be 15s+), so allow 3 minutes
        test.setTimeout(180000);

        await addCard(page, 'Grab', 'Software Intern', 'Saved');
        const card = getCard(page, 'Grab', 'Software Intern');

        // open the checklist from the card's 3 dot menu
        await card.getByRole('button', { name: 'Card options' }).click();
        await card.getByRole('button', { name: 'Checklist' }).click();

        // the limit disclaimer shows from the start
        await expect(page.getByText('0 / 15 tasks, up to 100 characters each.')).toBeVisible();
        await addTask(page, 'Research the company');

        // adding the same task again (in any capitals) is blocked each time
        const taskBox = page.getByRole('textbox', { name: 'e.g. Research the company' });
        const addButton = page.getByRole('button', { name: 'Add Task', exact: true });
        await taskBox.fill('Research the company');
        await addButton.click();
        await taskBox.fill('research the company');
        await addButton.click();
        await taskBox.fill('RESEARCH THE COMPANY');
        await addButton.click();
        await expect(page.getByText('This task is already on the checklist.')).toBeVisible();
        await expect(page.getByText('1 / 15 tasks, up to 100 characters each.')).toBeVisible();

        // typing more than 100 characters stops at 100
        await taskBox.fill('');
        await taskBox.pressSequentially('x'.repeat(120));
        await expect(taskBox).toHaveValue('x'.repeat(100));
        await taskBox.fill('');

        // keep adding until the card has 15 tasks (Task 02 to Task 15)
        for (let i = 2; i <= 15; i++) {
            await addTask(page, 'Task ' + String(i).padStart(2, '0'));
        }

        // at the limit the add box locks and the warning shows
        await expect(page.getByText("You've reached the limit of 15 tasks. Delete a task to add another.")).toBeVisible();
        await expect(taskBox).toBeDisabled();
        await expect(addButton).toBeDisabled();

        await page.getByRole('button', { name: 'Done' }).click();
        await expect(card).toContainText('0 / 15 Prep');

        // reload to check all 15 were saved and it's still locked
        await page.reload();
        await expect(card).toContainText('0 / 15 Prep');
        await card.getByRole('button', { name: 'Card options' }).click();
        await card.getByRole('button', { name: 'Checklist' }).click();
        await expect(taskBox).toBeDisabled();

        // deleting a task unlocks the add box again
        await page.getByRole('listitem').filter({ hasText: 'Task 15' }).getByRole('button').click();
        await expect(page.getByText('14 / 15 tasks, up to 100 characters each.')).toBeVisible();
        await expect(taskBox).toBeEnabled();
    });
});
