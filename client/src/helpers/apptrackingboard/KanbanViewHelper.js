import { 
    getApplications,
    updateStatus, 
    updateInterviewDate,
    addApplication,
    updateFavourite,
    addTask,
    updateTask,
    deleteTask,
    deleteApplication
} from '../../services/applicationsApi.js'

const mobileWidth = 768; // fixed bp for mobile px

export function isMobileScreen () { return window.innerWidth < mobileWidth; }

// only the applications that belong in this column
export function applicationsInColumn (applications, col) {
  return applications.filter(app => app.status == col);
}

// only the applications whose title or company has the search text in it, ignores capitals
export function searchApplications (applications, searchText) {
  const text = searchText.trim().toLowerCase();
  if (text === '') return applications; // empty search shows every card

  return applications.filter(app =>
    app.title.toLowerCase().includes(text) || app.company.toLowerCase().includes(text)
  );
}

// only the favourite applications when favouritesOnly is true, otherwise all of them
export function filterFavourites (applications, favouritesOnly) {
  if (!favouritesOnly) return applications;
  return applications.filter(app => app.isFavourite);
}

// turn a date into a number so two dates can be compared, no date counts as far in the future
function dateToNumber (value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  return new Date(value).getTime();
}

// sort a copy of the apps, the original order from the backend stays the same
// deadline puts the soonest due first, latest puts the newest saved first, anything else keeps the order
export function sortApplications (applications, sortBy) {
  const sorted = applications.slice(); // copy so sort doesn't change the original list

  if (sortBy === 'deadline') {
    sorted.sort((a, b) => dateToNumber(a.expiryDate) - dateToNumber(b.expiryDate));
  }
  else if (sortBy === 'latest') {
    sorted.sort((a, b) => dateToNumber(b.createdAt) - dateToNumber(a.createdAt));
  }
  return sorted;
}

// copy the mouse position from the event into mp, which is { xPos, yPos }
export function updateMousePosition (mp, event) {
  mp.xPos = event.clientX;
  mp.yPos = event.clientY;
}

// move a card to a new column and save it
// returns true if the card now needs an interview date so the page can open the modal
export async function moveCard (card, updatedStatus) {
  if (card.status === updatedStatus) return false;

  const oldStatus = card.status;
  card.status = updatedStatus;

  try {
    await updateStatus(card._id, updatedStatus);
  } catch (err) {
    card.status = oldStatus // if fail, revert
    return false;
  }
  return updatedStatus === 'Interview' && !card.interviewAt;
}

// save the interview date for a card
export async function saveInterviewDate (card, date) {
  await updateInterviewDate(card._id, date);
  card.interviewAt = date;
}

// true if the board already has a card with the same title and company, ignores capitals
export function isDuplicateApplication (applications, details) {
  const title = details.title.toLowerCase();
  const company = details.companyName.toLowerCase();

  let isDuplicate = false;
  applications.forEach(app => {
    if (app.title.toLowerCase() === title && app.company.toLowerCase() === company) {
      isDuplicate = true;
    }
  });
  return isDuplicate;
}

// add an application typed in by the user, then fetch the board again
export async function addNewApplication (details) {
  await addApplication(details);
  return await getApplications();
}

// delete a card, named deleteApplicationCard so it doesn't clash with deleteApplication from the api
export async function deleteApplicationCard (card) {
  await deleteApplication(card._id);
}

// star or unstar a card, changes on screen first then saves
export async function toggleFavourite (card) {
  card.isFavourite = !card.isFavourite;
  await updateFavourite(card._id, card.isFavourite);
}

// recount how many tasks are done for the card's prep text
function countPrep (card) {
  let done = 0;
  card.tasks.forEach(task => {
    if (task.done) done++;
  });
  card.prep = done + ' / ' + card.tasks.length;
}

// add a task to the checklist
export async function addChecklistTask (card, text) {
  // show it straight away, then swap in the saved list so the new task gets its _id
  card.tasks.push({ text: text, done: false });
  countPrep(card);

  const updated = await addTask(card._id, text);
  card.tasks = updated.tasks;
}

// tick or untick a task
export async function toggleChecklistTask (card, task) {
  task.done = !task.done; // cross it out straight away
  countPrep(card);

  await updateTask(card._id, task._id, task.done);
}

// delete a task from the checklist
export async function deleteChecklistTask (card, task) {
  card.tasks = card.tasks.filter(t => t._id !== task._id); // delete it straight away
  countPrep(card);

  await deleteTask(card._id, task._id);
}

export function formatDate (value) {
  if (!value) return ''; // no date, e.g. interviewAt is null
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  });
}