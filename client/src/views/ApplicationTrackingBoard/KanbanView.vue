<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import ApplicationCard from './components/ApplicationCard.vue'
import CardMenu from './components/CardMenu.vue';
import { getApplications } from '../../services/applicationsApi.js';
import InterviewDateModel from './components/modals/InterviewDateModel.vue';
import AddApplicationModal from './components/modals/AddApplicationModal.vue';
import AddChecklistModal from './components/modals/AddChecklistModal.vue';
import DeleteCardModal from './components/modals/DeleteCardModal.vue';

import {
  isMobileScreen,
  applicationsInColumn,
  updateMousePosition,
  moveCard,
  saveInterviewDate,
  isDuplicateApplication,
  addNewApplication,
  deleteApplicationCard,
  toggleFavourite,
  addChecklistTask,
  toggleChecklistTask,
  removeChecklistTask
} from './helpers/KanbanViewHelper.js';

const kanbanColumns = ['Saved', 'Applied', 'Interview', 'Offered'];

// loaded from the backend in onMounted
const applications = ref([]);

const draggedCard = ref(null);
const selectedColumn = ref(null);
const mousePosition = ref({ xPos: 0, yPos: 0 });
const isMobile = ref(false);

const interviewCard = ref(null); // the card waiting for a date, null means the prompt is closed
const checklistCard = ref(null); // the card whose checklist is open, null means closed
const deletedCard = ref(null); // the card which is being deleted, null means modal closed

const showAddModal = ref(false); 
const addStatus = ref(''); // which column the add form starts in, set by each column's + button
const errorMessage = ref(''); // shown in the open modal, or at the top of the page if no modal is open

function checkScreen () { isMobile.value = isMobileScreen(); }

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
    errorMessage.value = 'Could not remove the card. Please try again.'; // modal stays open with the error
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

// checklist add, tick or remove a task, errors show inside the checklist
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
    await removeChecklistTask(checklistCard.value, task);
  } catch (err) {
    errorMessage.value = 'Could not delete the task. Please refresh the page.';
  }
}

onMounted(async () => {
  checkScreen(); // set the real value on load
  window.addEventListener('resize', checkScreen);
  applications.value = await getApplications();
})

onUnmounted(() => {
  window.removeEventListener('resize', checkScreen)
});

</script>

<template>
<div class="bg-light min-vh-100 p-3 p-md-4">
  <!-- Top Area -->
  <div class="bg-white border rounded-4 d-flex flex-wrap gap-3 justify-content-between align-items-center p-3 p-md-4 mb-3">
    <div>
      <h1 class="h5 fw-semibold mb-1">Applications</h1>
      <p class="small text-secondary mb-0">{{ applications.length }} internships tracked</p>
    </div>

    <div class="d-flex flex-wrap gap-2 align-items-center">
      <!-- Application Search, Filter and Sort options -->
      <input type="search" class="form-control rounded-3 w-auto" placeholder="Search applications..."/>
      <button class="btn btn-dark rounded-3" v-on:click="openAddModal('Saved')">
        Add Application +
      </button>
    </div>
  </div>

  <!-- Error message, only shows if something failed and no modal is open -->
  <div v-if="errorMessage && !isModalOpen()" class="alert alert-danger">{{ errorMessage }}</div>

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
      <div class="bg-white border rounded-4 p-3" :class="{ 'border-primary': draggedCard && selectedColumn == col }">
        <!-- column header -->
        <div class="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
          <h2 class="h6 fw-semibold mb-0">
            {{ col }}
            <span class="text-secondary fw-normal">({{ applicationsInColumn(applications, col).length }})</span>
          </h2>
          <button class="btn btn-dark btn-sm rounded-3 px-3" v-on:click="openAddModal(col)" :aria-label="'Add to ' + col">+</button>
        </div>

        <!-- handle card dragging -->
        <!-- (inner loop) only shows applications which match the status of the current looped column -->
        <div
            v-for="app in applicationsInColumn(applications, col)" 
            :key="app._id"
            class="mb-3 user-select-none cursor-grab position-relative"
            :style="{ opacity: draggedCard == app ? 0.5 : 1 }"
            v-on:pointerdown="startDrag($event, app)"
        >
            <ApplicationCard :app="app">
              <select v-if="isMobile" 
                :value="app.status" 
                v-on:change="onMoveCard(app, $event.target.value)" 
                v-on:pointerdown.stop
                class="form-select form-select-sm mt-3">
                <option v-for="col in kanbanColumns" :key="col" :value="col">Move to {{ col }}</option>
              </select>
            </ApplicationCard>

            <!-- 3 dot menu on the top right of the card -->
            <CardMenu
              :isFavourite="app.isFavourite"
              v-on:remove="openDeleteCardModal(app)"
              v-on:favourite="onToggleFavourite(app)"
              v-on:checklist="openChecklist(app)"
            />
        </div>

        <div v-if="!isMobile" class="border-dashed rounded-4 p-4 text-center" :class="{ 'border-primary': draggedCard && selectedColumn == col }">
            <p class="small text-secondary mb-0">Drag card here</p>
        </div>
      </div>
    </div>
  </div>
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

  <!-- Checklist Modal -->
  <AddChecklistModal
    v-if="checklistCard"
    :card="checklistCard"
    :errorMessage="errorMessage"
    v-on:add="onAddTask"
    v-on:toggle="onToggleTask"
    v-on:remove="onDeleteTask"
    v-on:close="closeChecklist"
  />

  <!-- Add Application Modal -->
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
      border: 2px dashed #d5def0;
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
      z-index: 1000;
  }
</style>