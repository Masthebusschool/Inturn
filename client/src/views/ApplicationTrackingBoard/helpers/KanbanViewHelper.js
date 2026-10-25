import { 
    updateStatus, 
    updateInterviewDate,
    addApplication
} from '../../../services/applicationsApi.js'

const MOBILE_WIDTH = 768;

export function isMobileScreen () { return window.innerWidth < MOBILE_WIDTH; }

// only the applications that belong in this column
export function applicationsInColumn (applications, col) {
  return applications.filter(app => app.status == col);
}

// copy the mouse position from the event into mp ({ xPos, yPos })
export function updateMousePosition (mp, event) {
  mp.xPos = event.clientX;
  mp.yPos = event.clientY;
}

// move a card to a new column and save it.
// returns true if the card now needs an interview date (so the page can open the modal)
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

// add an application typed in by the user, then fetch the board again.
// returns the updated list of applications, or null if saving failed
export async function addNewApplication (details) {
  try {
    await addApplication(details);
    return await getApplications();
  } catch (err) {
    return null;
  }
}

export function formatDate (value) {
  if (!value) return ''; // no date (e.g. interviewAt is null)
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  });
}