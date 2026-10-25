<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import ApplicationCard from './components/ApplicationCard.vue'
import { getApplications } from '../../services/applicationsApi.js';
import InterviewDateModel from './components/modals/InterviewDateModel.vue';
import AddApplicationModal from './components/modals/AddApplicationModal.vue';

import {
  isMobileScreen,
  applicationsInColumn,
  updateMousePosition,
  moveCard,
  saveInterviewDate,
  addNewApplication
} from './helpers/KanbanViewHelper.js';

const kanbanColumns = ['Saved', 'Applied', 'Interview', 'Offered'];
// note: async onMounted from the backend
const applications = ref([]);

const draggedCard = ref(null);
const selectedColumn = ref(null);
const mousePosition = ref({ xPos: 0, yPos: 0 });
const isMobile = ref(false);

const interviewCard = ref(null); // the card waiting for a date (null = prompt closed)

const showAddModal = ref(false); 
const errorMessage = ref(''); // shown at the top of the page if something fails

function checkScreen () { isMobile.value = isMobileScreen(); }

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

async function onSaveInterviewDate (date) {
  await saveInterviewDate(interviewCard.value, date);
  interviewCard.value = null;
}

function skipInterviewDate() { interviewCard.value = null; }

function setSelectedColumn (val) { selectedColumn.value = val; }

function setDraggedCard (card) { draggedCard.value = card; }

function startDrag(event, app) {
  if (isMobile.value) return;
  setDraggedCard(app);
  updateMousePosition(mousePosition.value, event);
}

function closeAddModal () {
  showAddModal.value = false;
  errorMessage.value = '';
}

// add application form: save it, then show the updated board
async function onAddApplication (details) {
  const updatedApplications = await addNewApplication(details);

  if (!updatedApplications) {
    errorMessage.value = 'Could not add the application. Please try again.'; // form stays open so nothing is lost
    return;
  }

  applications.value = updatedApplications;
  closeAddModal();
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
  <!-- Top Area -->
  <div class="container-fluid my-4 p-4 d-flex justify-content-between align-items-center">
    <p>Applications</p>
    <button class="btn btn-secondary" v-on:click="showAddModal = true">
      Add Application
    </button>
  </div>
  <!-- Error message (only shows if something failed) -->
  <div v-if="errorMessage" class="alert alert-danger mx-3">{{ errorMessage }}</div>
  <!-- Application Search / Filter / Sort options -->
  <div class="container-fluid d-flex justify-content-between align-items-center">
    <input type="search" class="form-control rounded-pill" placeholder="Search Applications..."/>
    
  </div>
  <!-- Application Tracking Boards -->
  <div
    class="container-fluid py-4 min-vh-100 d-flex gap-3 align-items-start"
    v-on:pointermove="updateMousePosition(mousePosition, $event)"
    v-on:pointerup="dropCard"
  >
    <!-- outer loop which loads the individual columns -->
    <div
    v-for="col in kanbanColumns"
    :key="col"
    class="col-12 col-md-6 col-lg-3 bg-body-tertiary shadow-sm p-4 mb-5 rounded"
    v-on:pointerenter="setSelectedColumn(col)"
    v-on:pointerleave="setSelectedColumn(null)"
    >
    <h2 class="h5 fw-bold">{{ col }}</h2>

    <!-- handle card dragging -->
    <!-- (inner loop) only shows applications which match the status of the current looped column -->
        <div
            v-for="app in applicationsInColumn(applications, col)" 
            :key="app._id"
            class="mb-3 user-select-none cursor-grab"
            :style="{ opacity: draggedCard == app ? 0.5 : 1 }"
            v-on:pointerdown="startDrag($event, app)"
        >
            <ApplicationCard :app="app">
              <select v-if="isMobile" 
                :value="app.status" 
                v-on:change="onMoveCard(app, $event.target.value)" 
                class="form-select form-select-sm my-1">
                <option v-for="col in kanbanColumns" :key="col" :value="col">Move to {{ col }}</option>
              </select>
            </ApplicationCard>
        </div>

        <div v-if="!isMobile" class="border-dotted p-4 my-4 text-center text-capitalize">
            <p class="text-secondary">Drag card here</p>
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
    v-on:save="onSaveInterviewDate"
    v-on:skip="skipInterviewDate"
   />

  <!-- Add Application Modal -->
  <AddApplicationModal
    v-if="showAddModal"
    v-on:submit="onAddApplication"
    v-on:cancel="closeAddModal"
  />
</template>

<style scoped>
  .border-dotted {
      border: 2px solid lightgray;
      border-style: dashed;
      border-radius: 20px;
  }

  .cursor-grab { 
      cursor: grab; 
  }

  .lifted {
      position: fixed;
      width: 192px;
      transform: translate(-50%, -50%); /* center on the mouse */
      pointer-events: none; /* so the column underneath still notices the mouse */
      z-index: 1000;
  }
</style>