<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import ApplicationCard from '../components/apptrackingboard/ApplicationCard.vue'
import CardMenu from '../components/apptrackingboard/CardMenu.vue';
import { getApplications } from '../services/applicationsApi.js';
import InterviewDateModel from '../components/apptrackingboard/modals/InterviewDateModel.vue';
import ApplicationModal from '../components/apptrackingboard/modals/ApplicationModal.vue';
import AddChecklistModal from '../components/apptrackingboard/modals/AddChecklistModal.vue';
import DeleteCardModal from '../components/apptrackingboard/modals/DeleteCardModal.vue';
import { authStore } from '../stores/auth.js';
import {
  isMobileScreen,
  isTabletScreen,
  applicationsInColumn,
  searchApplications,
  filterFavourites,
  sortApplications,
  updateMousePosition,
  moveCard,
  saveInterviewDate,
  isDuplicateApplication,
  addNewApplication,
  editApplication,
  deleteApplicationCard,
  toggleFavourite,
  addChecklistTask,
  toggleChecklistTask,
  deleteChecklistTask
} from '../helpers/apptrackingboard/KanbanViewHelper.js';

const user = computed(() => authStore.user);
const router = useRouter();
const kanbanColumns = ['Saved', 'Applied', 'Interview', 'Offered'];

function goToSkillGap (card) {
  router.push({ path: '/skill-gap', query: { applicationId: card._id } });
}

// opens interview intel filtered to this job (SPECIFICALLY by the company and title of the application)
function goToIntel (card) {
  router.push({ path: '/intel', query: { company: card.company, role: card.title } });
}

const applications = ref([]);
// true while the apps are being fetched, shows the spinner instead of the page
const isLoading = ref(true); 
// true if fetching the apps failed, shows the try again button
const loadFailed = ref(false); 

const searchText = ref(''); 
const sortBy = ref('default'); 
const favouritesOnly = ref(false);

const visibleApplications = computed(() => {
  let list = searchApplications(applications.value, searchText.value);
  list = filterFavourites(list, favouritesOnly.value);
  list = sortApplications(list, sortBy.value);
  return list;
});

// true if the search or the favourites filter is hiding some cards
const isFiltering = computed(() => searchText.value.trim() !== '' || favouritesOnly.value);

// true if the search, sort or favourites filter is not on its default, shows the reset button
const hasChanges = computed(() => isFiltering.value || sortBy.value !== 'default');

// put the search, sort and favourites filter back to how they start
function resetFilters () {
  searchText.value = '';
  sortBy.value = 'default';
  favouritesOnly.value = false;
}

const draggedCard = ref(null);
const selectedColumn = ref(null);
const mousePosition = ref({ xPos: 0, yPos: 0 });
// on mobile and tablet, cards move with the dropdown instead of dragging
// on tablet only, the stacked columns can be collapsed
const isMobile = ref(false);
const isTablet = ref(false);
const collapsedCards = ref([]);
const collapsedColumns = ref([]);

// the respective card states of each modal, null means the prompt is closed
const interviewCard = ref(null); 
const checklistCard = ref(null); 
const deletedCard = ref(null); 
const editCard = ref(null); 

const showAddModal = ref(false); 
const addStatus = ref('Saved'); 
const errorMessage = ref(''); 

function checkScreen () {
  isMobile.value = isMobileScreen();
  isTablet.value = isTabletScreen();

  // columns can only be collapsed on tablet, so reopen them when leaving it
  if (!isTablet.value) {
    collapsedColumns.value.forEach(col => document.getElementById('column-' + col)?.classList.add('show'));
    collapsedColumns.value = [];
  }
}

// bootstrap fires these when a column starts opening/closing
// (target check because the cards' collapse events bubble up through the column)
function onColumnToggle (event, col) {
  if (event.target !== event.currentTarget) return;
  if (collapsedColumns.value.includes(col)) {
    collapsedColumns.value = collapsedColumns.value.filter(c => c !== col);
  } else {
    collapsedColumns.value.push(col);
  }
}

function isColumnCollapsed (col) {
  return collapsedColumns.value.includes(col);
}

// open or close a card, removes it from the list if it's there, adds it if not
// kept here (not in the card) so a card stays closed after moving to another column
function toggleCard (card) {
  if (collapsedCards.value.includes(card._id)) {
    collapsedCards.value = collapsedCards.value.filter(id => id !== card._id);
  } else {
    collapsedCards.value.push(card._id);
  }
}

async function loadApplications () {
  isLoading.value = true;
  loadFailed.value = false;

  try {
    applications.value = await getApplications();
  } catch (err) {
    loadFailed.value = true;
  }

  isLoading.value = false;
}

// true if any modal is open, so the page alert stays hidden behind it
function isModalOpen () {
  return showAddModal.value || checklistCard.value || interviewCard.value || deletedCard.value || editCard.value;
}

// move a card, then open the date prompt if it landed in Interview without a date
async function onMoveCard (card, updatedStatus) {
  const needsInterviewDate = await moveCard(card, updatedStatus);
  if (needsInterviewDate) interviewCard.value = card;
}

function dropCard() {
  if (draggedCard.value && selectedColumn.value) {
    onMoveCard(draggedCard.value, selectedColumn.value);
  }
  draggedCard.value = null;
}

function closeInterviewModal () {
  interviewCard.value = null;
  errorMessage.value = '';
}

// save the date, the modal stays open with the error if it fails
async function onSaveInterviewDate (date) {
  try {
    await saveInterviewDate(interviewCard.value, date);
    closeInterviewModal();
  } catch (err) {
    errorMessage.value = 'Could not save the interview date. Please try again.';
  }
}

function setSelectedColumn (val) { selectedColumn.value = val; }

function startDrag(event, app) {
  if (isMobile.value || isTablet.value) return;
  draggedCard.value = app;
  updateMousePosition(mousePosition.value, event);
}

// open the add form, starting in the given column
function openAddModal (status) {
  errorMessage.value = '';
  addStatus.value = status;
  showAddModal.value = true;
}

function closeAddModal () {
  showAddModal.value = false;
  errorMessage.value = '';
}

// add application form, save it then show the updated board
async function onAddApplication (details) {
  // prevents duplicates before calling the backend
  if (isDuplicateApplication(applications.value, details)) {
    errorMessage.value = 'You already have this application on your board. Please enter a different one.';
    return;
  }

  try {
    applications.value = await addNewApplication(details);
    closeAddModal();
  } catch (err) {
    errorMessage.value = 'Could not add the application. Please try again.';
  }
}

// 3 dot menu edit card
function openEditModal (card) {
  errorMessage.value = '';
  editCard.value = card;
}

function closeEditModal () {
  editCard.value = null;
  errorMessage.value = '';
}

// edit form, save it then show the updated board
async function onEditApplication (details) {
  // the card being edited doesn't count as a duplicate of itself
  if (isDuplicateApplication(applications.value, details, editCard.value._id)) {
    errorMessage.value = 'You already have this application on your board. Please enter a different one.';
    return;
  }

  try {
    applications.value = await editApplication(editCard.value, details);
    closeEditModal();
  } catch (err) {
    errorMessage.value = 'Could not save the changes. Please try again.'; 
  }
}

// 3 dot menu delete card
function openDeleteCardModal (card) {
  errorMessage.value = '';
  deletedCard.value = card;
}

function closeDeleteCardModal () {
  deletedCard.value = null;
  errorMessage.value = '';
}

// delete modal confirm
async function onDeleteCard () {
  const card = deletedCard.value;

  try {
    await deleteApplicationCard(card);
    applications.value = applications.value.filter(app => app._id !== card._id);
    closeDeleteCardModal();
  } catch (err) {
    errorMessage.value = 'Could not delete the card. Please try again.';
  }
}

// 3 dot menu favourite or unfavourite
async function onToggleFavourite (card) {
  try {
    await toggleFavourite(card);
  } catch (err) {
    errorMessage.value = 'Could not save the favourite. Please refresh the page.';
  }
}

// 3 dot menu open or close the checklist
function openChecklist (card) {
  errorMessage.value = '';
  checklistCard.value = card;
}

function closeChecklist () {
  checklistCard.value = null;
  errorMessage.value = '';
}

// checklist add, tick or delete a task, errors show inside the checklist
async function onAddTask (text) {
  try {
    await addChecklistTask(checklistCard.value, text);
  } catch (err) {
    errorMessage.value = 'Could not save the task. Please refresh the page.';
  }
}

async function onToggleTask (task) {
  try {
    await toggleChecklistTask(checklistCard.value, task);
  } catch (err) {
    errorMessage.value = 'Could not save the task. Please refresh the page.';
  }
}

async function onDeleteTask (task) {
  try {
    await deleteChecklistTask(checklistCard.value, task);
  } catch (err) {
    errorMessage.value = 'Could not delete the task. Please refresh the page.';
  }
}

onMounted(async () => {
  checkScreen(); 
  window.addEventListener('resize', checkScreen);
  await loadApplications();
})

onUnmounted(() => {
  window.removeEventListener('resize', checkScreen)
});

</script>

<template>
<div>
  <!-- spinner in the page area -->
  <div v-if="isLoading" class="d-flex flex-column justify-content-center align-items-center text-secondary" style="min-height: 70vh">
    <div class="spinner-border text-primary mb-3" role="status"></div>
    <p class="mb-0">Loading your applications...</p>
  </div>

  <!-- when the apps cannot be fetched -->
  <div v-else-if="loadFailed" class="d-flex flex-column justify-content-center align-items-center text-center" style="min-height: 70vh">
    <p class="mb-3">Could not load your applications. Please check your connection.</p>
    <button class="btn-neutral-inturn" v-on:click="loadApplications">Try again</button>
  </div>
  <!-- when no user in auth store -->
  <div v-else-if="!user">
      <p class="mb-3 text-danger">User not found. Please login!</p>
  </div>

  <template v-else>
    <header class="page-header">
      <div>
        <h1 class="header-title">Tracker Board</h1>
        <p class="header-subtitle">
        {{ applications.length }} {{ applications.length === 1 ? 'internship' : 'internships' }} tracked
        </p>
      </div>

      <button class="btn-primary-inturn flex-shrink-0" v-on:click="openAddModal('Saved')">
        Add Application +
      </button>
    </header>

    <!-- search, sort, favourites and reset -->
    <div class="card-inturn mb-3">
      <div class="d-flex flex-wrap gap-2 align-items-center">
        <!-- search by job title or company, filters the board as you type -->
        <input v-model="searchText" type="search" class="input-inturn w-auto" placeholder="Search title or company"/>

        <!-- sort the cards inside each column -->
        <select v-model="sortBy" class="input-inturn w-auto" aria-label="Sort applications">
          <option value="default">Sort by default</option>
          <option value="deadline">Deadline, soonest first</option>
          <option value="latest">Latest saved</option>
        </select>

        <!-- show only favourites, is-active when it's on -->
        <button
          type="button"
          class="chip-inturn"
          :class="{ 'is-active': favouritesOnly }"
          v-on:click="favouritesOnly = !favouritesOnly"
        >
          &#9733; Favourites
        </button>

        <!-- clears the search, sort and favourites filter, only shows when one of them is on -->
        <button
          v-if="hasChanges"
          type="button"
          class="btn-neutral-inturn"
          v-on:click="resetFilters"
        >
          &#8634; Reset
        </button>
      </div>
    </div>

    <!-- error message only shows if something failed and no modal is open -->
    <div v-if="errorMessage && !isModalOpen()" class="alert alert-danger">{{ errorMessage }}</div>

    <!-- nothing matches the search or the favourites filter -->
    <p v-if="isFiltering && visibleApplications.length === 0" class="text-secondary">
      No applications match your search or filter.
    </p>
    <p v-else-if="isFiltering">
      {{ visibleApplications.length }} results found.
    </p>

    <div
      class="board-row row g-2 align-items-start flex-nowrap flex-md-wrap pb-2"
      v-on:pointermove="updateMousePosition(mousePosition, $event)"
      v-on:pointerup="dropCard"
    >
      <!-- outer loop which loads the individual columns -->
      <div
      v-for="col in kanbanColumns"
      :key="col"
      class="col-10 col-sm-8 col-md-12 col-lg-3"
      v-on:pointerenter="setSelectedColumn(col)"
      v-on:pointerleave="setSelectedColumn(null)"
      >
        <div class="card-inturn px-2" :class="{ 'border-primary': draggedCard && selectedColumn == col }">
          <div
            class="d-flex justify-content-between align-items-center px-2"
            :class="{ 'mb-3 pb-3 border-bottom': !isColumnCollapsed(col) }"
          >
            <!-- on tablet the title is a button that opens/closes the column -->
            <h2 class="h6 fw-semibold mb-0">
              <button
                v-if="isTablet"
                type="button"
                class="btn btn-link p-0 d-flex align-items-center gap-2 text-reset text-decoration-none fw-semibold"
                data-bs-toggle="collapse"
                :data-bs-target="'#column-' + col"
                :aria-expanded="!isColumnCollapsed(col)"
                :aria-controls="'column-' + col"
              >
                <i class="bi small" :class="isColumnCollapsed(col) ? 'bi-chevron-down' : 'bi-chevron-up'"></i>
                {{ col }}
                <span class="text-secondary fw-normal">({{ applicationsInColumn(visibleApplications, col).length }})</span>
              </button>
              <template v-else>
                {{ col }}
                <span class="text-secondary fw-normal">({{ applicationsInColumn(visibleApplications, col).length }})</span>
              </template>
            </h2>
            <!-- column + button starts the form in this column -->
            <button class="btn-secondary-inturn btn-sm-inturn" v-on:click="openAddModal(col)" :aria-label="'Add to ' + col">+</button>
          </div>

          <!-- column contents, a bootstrap collapse (only toggled on tablet) -->
          <!-- object form of v-on so the dots in 'show.bs.collapse' aren't read as modifiers -->
          <div
            :id="'column-' + col"
            class="collapse show"
            v-on="{
              'show.bs.collapse': event => onColumnToggle(event, col),
              'hide.bs.collapse': event => onColumnToggle(event, col)
            }"
          >
          <!-- inner loop only shows applications matching the status of the current looped column -->
          <div
            class="d-flex flex-column gap-3"
            :class="{ 'mb-3': applicationsInColumn(visibleApplications, col).length > 0 }"
          >
            <div
                v-for="app in applicationsInColumn(visibleApplications, col)" 
                :key="app._id"
                class="user-select-none cursor-grab position-relative"
                :style="{ opacity: draggedCard == app ? 0.5 : 1 }"
                v-on:pointerdown="startDrag($event, app)"
            >
                <ApplicationCard
                  :app="app"
                  :collapsed="collapsedCards.includes(app._id)"
                  v-on:toggle="toggleCard(app)"
                  v-on:tailor-resume="goToSkillGap"
                  v-on:view-intel="goToIntel"
                >
                  <select v-if="isMobile || isTablet" 
                    :value="app.status" 
                    v-on:change="onMoveCard(app, $event.target.value)" 
                    v-on:pointerdown.stop
                    class="input-inturn mt-3">
                    <option v-for="col in kanbanColumns" :key="col" :value="col">Move to {{ col }}</option>
                  </select>
                </ApplicationCard>

                <!-- 3 dot menu on the top right of the card -->
                <CardMenu
                  :isFavourite="app.isFavourite"
                  v-on:edit="openEditModal(app)"
                  v-on:delete="openDeleteCardModal(app)"
                  v-on:favourite="onToggleFavourite(app)"
                  v-on:checklist="openChecklist(app)"
                />
            </div>
          </div>

          <div v-if="!isMobile && !isTablet" class="border-dashed p-4 text-center" :class="{ 'border-primary': draggedCard && selectedColumn == col }">
              <p class="small text-secondary mb-0">Drag card here</p>
          </div>
          </div>
        </div>
      </div>
    </div>
  </template>
</div>
  <!-- draggedCard -->
  <div
    v-if="draggedCard && !isMobile && !isTablet"
    class="lifted"
    :style="{ left: mousePosition.xPos + 'px', top: mousePosition.yPos + 'px' }"
  >
    <ApplicationCard :app="draggedCard" :collapsed="collapsedCards.includes(draggedCard._id)" />
  </div>

  <!-- Interview Date Modal -->
   <InterviewDateModel
    v-if="interviewCard"
    :card="interviewCard"
    :errorMessage="errorMessage"
    v-on:save="onSaveInterviewDate"
    v-on:skip="closeInterviewModal"
   />

  <!-- Checklist Modal for tasks -->
  <AddChecklistModal
    v-if="checklistCard"
    :card="checklistCard"
    :errorMessage="errorMessage"
    v-on:add="onAddTask"
    v-on:toggle="onToggleTask"
    v-on:delete="onDeleteTask"
    v-on:close="closeChecklist"
  />

  <!-- Add Application Modal, startStatus picks which column the form starts in -->
  <ApplicationModal
    v-if="showAddModal"
    :errorMessage="errorMessage"
    :startStatus="addStatus"
    v-on:submit="onAddApplication"
    v-on:cancel="closeAddModal"
  />

  <!-- Edit Application Modal, using the same form and card details -->
  <ApplicationModal
    v-if="editCard"
    :card="editCard"
    :errorMessage="errorMessage"
    v-on:submit="onEditApplication"
    v-on:cancel="closeEditModal"
  />

  <!-- Delete Card Modal -->
  <DeleteCardModal
    v-if="deletedCard"
    :card="deletedCard"
    :errorMessage="errorMessage"
    v-on:cancel="closeDeleteCardModal"
    v-on:confirm="onDeleteCard"
  />
</template>

<style scoped>
  /* bootstrap has no dashed border or grab cursor */
  .cursor-grab {
      cursor: grab; 
  }

  .border-dashed {
      border: 2px dashed var(--inturn-border-strong);
      border-radius: var(--r-md);
  }

  /* mobile only: the columns sit in one row you swipe sideways */
  .board-row {
      overflow-x: auto;
  }

  /* from tablet up the columns wrap, so no scroll is needed */
  @media (min-width: 768px) {
    .board-row {
        overflow: visible;
    }
  }

  /* the card following the mouse while dragging */
  .lifted {
      position: fixed;
      width: 260px;
      transform: translate(-50%, -50%); /* center on the mouse */
      pointer-events: none; /* so the column underneath still notices the mouse */
      z-index: 1; /* on drag card is above column */
  }
</style>