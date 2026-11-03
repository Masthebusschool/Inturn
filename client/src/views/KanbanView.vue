<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import ApplicationCard from '../components/apptrackingboard/ApplicationCard.vue'
import CardMenu from '../components/apptrackingboard/CardMenu.vue';
import { getApplications } from '../services/applicationsApi.js';
import InterviewDateModel from '../components/apptrackingboard/modals/InterviewDateModel.vue';
import AddApplicationModal from '../components/apptrackingboard/modals/AddApplicationModal.vue';
import AddChecklistModal from '../components/apptrackingboard/modals/AddChecklistModal.vue';
import DeleteCardModal from '../components/apptrackingboard/modals/DeleteCardModal.vue';
import { authStore } from '../stores/auth.js';
import {
  isMobileScreen,
  applicationsInColumn,
  searchApplications,
  filterFavourites,
  sortApplications,
  updateMousePosition,
  moveCard,
  saveInterviewDate,
  isDuplicateApplication,
  addNewApplication,
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

// loaded from the backend in onMounted
const applications = ref([]);
const isLoading = ref(true); // true while the apps are being fetched, shows the spinner instead of the page
const loadFailed = ref(false); // true if fetching the apps failed, shows the try again button

const searchText = ref(''); // text in the search box
const sortBy = ref('default'); // default, deadline or latest
const favouritesOnly = ref(false); // true shows only favourite cards

// the cards to show, search first, then the favourites filter, then the sort
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
const isMobile = ref(false);

const interviewCard = ref(null); // the card waiting for a date, null means the prompt is closed
const checklistCard = ref(null); // the card whose checklist is open, null means closed
const deletedCard = ref(null); // the card which is being deleted, null means modal closed

const showAddModal = ref(false); 
const addStatus = ref('Saved'); // which column the add form starts in, Saved from the top button or the column from its + button
const errorMessage = ref(''); // shown in the open modal, or at the top of the page if no modal is open

function checkScreen () { isMobile.value = isMobileScreen(); }

// fetch the apps, the spinner shows while waiting and the try again button shows if it fails
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
  return showAddModal.value || checklistCard.value || interviewCard.value || deletedCard.value;
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

function setDraggedCard (card) { draggedCard.value = card; }

function startDrag(event, app) {
  if (isMobile.value) return;
  setDraggedCard(app);
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
  // stop duplicates before calling the backend
  if (isDuplicateApplication(applications.value, details)) {
    errorMessage.value = 'You already have this application on your board. Please enter a different one.';
    return;
  }

  try {
    applications.value = await addNewApplication(details);
    closeAddModal();
  } catch (err) {
    errorMessage.value = 'Could not add the application. Please try again.'; // form stays open so nothing is lost
  }
}

// 3 dot menu delete card, opens the delete modal first
function openDeleteCardModal (card) {
  errorMessage.value = '';
  deletedCard.value = card;
}

function closeDeleteCardModal () {
  deletedCard.value = null;
  errorMessage.value = '';
}

// delete modal confirm, the card comes from deletedCard since the modal doesn't send it
async function onDeleteCard () {
  const card = deletedCard.value;

  try {
    await deleteApplicationCard(card);
    applications.value = applications.value.filter(app => app._id !== card._id); // update the apps on the page
    closeDeleteCardModal();
  } catch (err) {
    errorMessage.value = 'Could not delete the card. Please try again.'; // modal stays open with the error
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
  <!-- spinner in the page area while the apps are being fetched, the nav stays visible -->
  <div v-if="isLoading" class="d-flex flex-column justify-content-center align-items-center text-secondary" style="min-height: 70vh">
    <div class="spinner-border text-primary mb-3" role="status"></div>
    <p class="mb-0">Loading your applications...</p>
  </div>

  <!-- the apps cannot be fetched -->
  <div v-else-if="loadFailed" class="d-flex flex-column justify-content-center align-items-center text-center" style="min-height: 70vh">
    <p class="mb-3">Could not load your applications. Please check your connection.</p>
    <button class="btn-neutral-inturn" v-on:click="loadApplications">Try again</button>
  </div>
  <!-- no user in auth store -->
  <div v-else-if="!user">
      <p class="mb-3 text-danger">User not found. Please login!</p>
  </div>

  <!-- the whole page, only shows once the apps are loaded -->
  <template v-else>
    <!-- Top Area: page title on the left and add application on the right -->
    <header class="page-header">
      <div>
        <h1 class="header-title">Tracker Board</h1>
        <p v-if="applications.length==1">1 internship tracked</p>
        <p v-else>class="header-subtitle">{{ applications.length }} internships tracked</p>
      </div>

      <!-- top button always starts in Saved, flex-shrink-0 stops it squashing on small screens -->
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

    <!-- Error message, only shows if something failed and no modal is open -->
    <div v-if="errorMessage && !isModalOpen()" class="alert alert-danger">{{ errorMessage }}</div>

    <!-- nothing matches the search or the favourites filter -->
    <p v-if="isFiltering && visibleApplications.length === 0" class="text-secondary">
      No applications match your search or filter.
    </p>
    <p v-else-if="isFiltering">
      {{ visibleApplications.length }} results found.
    </p>

    <!-- Application Tracking Boards -->
    <!-- on mobile the columns sit in one row you can swipe sideways, from md up they wrap into the grid -->
    <div
      class="row g-3 align-items-start flex-nowrap flex-md-wrap overflow-x-auto pb-2"
      v-on:pointermove="updateMousePosition(mousePosition, $event)"
      v-on:pointerup="dropCard"
    >
      <!-- outer loop which loads the individual columns -->
      <div
      v-for="col in kanbanColumns"
      :key="col"
      class="col-10 col-sm-8 col-md-6 col-lg-3"
      v-on:pointerenter="setSelectedColumn(col)"
      v-on:pointerleave="setSelectedColumn(null)"
      >
        <!-- border-primary highlights the column the dragged card is over -->
        <div class="card-inturn" :class="{ 'border-primary': draggedCard && selectedColumn == col }">
          <!-- column header, the count only includes cards that match the search and filter -->
          <div class="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
            <h2 class="h6 fw-semibold mb-0">
              {{ col }}
              <span class="text-secondary fw-normal">({{ applicationsInColumn(visibleApplications, col).length }})</span>
            </h2>
            <!-- column + button starts the form in this column -->
            <button class="btn-secondary-inturn btn-sm-inturn" v-on:click="openAddModal(col)" :aria-label="'Add to ' + col">+</button>
          </div>

          <!-- handle card dragging -->
          <!-- (inner loop) only shows applications which match the status of the current looped column, the search and the filter, in the sorted order -->
          <div
              v-for="app in applicationsInColumn(visibleApplications, col)" 
              :key="app._id"
              class="mb-3 user-select-none cursor-grab position-relative"
              :style="{ opacity: draggedCard == app ? 0.5 : 1 }"
              v-on:pointerdown="startDrag($event, app)"
          >
              <ApplicationCard :app="app" v-on:tailor-resume="goToSkillGap">
                <select v-if="isMobile" 
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
                v-on:delete="openDeleteCardModal(app)"
                v-on:favourite="onToggleFavourite(app)"
                v-on:checklist="openChecklist(app)"
              />
          </div>

          <div v-if="!isMobile" class="border-dashed p-4 text-center" :class="{ 'border-primary': draggedCard && selectedColumn == col }">
              <p class="small text-secondary mb-0">Drag card here</p>
          </div>
        </div>
      </div>
    </div>
  </template>
</div>
  <!-- draggedCard -->
  <div
    v-if="draggedCard && !isMobile"
    class="lifted"
    :style="{ left: mousePosition.xPos + 'px', top: mousePosition.yPos + 'px' }"
  >
    <ApplicationCard :app="draggedCard" />
  </div>

  <!-- Interview Date Modal -->
   <InterviewDateModel
    v-if="interviewCard"
    :card="interviewCard"
    :errorMessage="errorMessage"
    v-on:save="onSaveInterviewDate"
    v-on:skip="closeInterviewModal"
   />

  <!-- Checklist Modal, v-on:delete matches the delete emit in AddChecklistModal -->
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
  <AddApplicationModal
    v-if="showAddModal"
    :errorMessage="errorMessage"
    :startStatus="addStatus"
    v-on:submit="onAddApplication"
    v-on:cancel="closeAddModal"
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
  .border-dashed {
      border: 2px dashed var(--inturn-border-strong);
      border-radius: var(--r-md);
  }

  .cursor-grab { 
      cursor: grab; 
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