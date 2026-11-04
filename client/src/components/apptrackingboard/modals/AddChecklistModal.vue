<script setup>
import { ref, computed } from 'vue';
import { MAX_TASKS, MAX_TASK_LENGTH } from '../../../utils/trackerBoardOptions.js';

// card is the card whose checklist is open, each task is { _id, text, done }
// errorMessage comes from the page if saving fails
const props = defineProps({
  card: Object,
  errorMessage: { type: String, default: '' }
});

const emit = defineEmits(['add', 'toggle', 'delete', 'close']);
// text in the add a task box
const newTask = ref('');
const isFull = computed(() => props.card.tasks.length >= MAX_TASKS);
const duplicateError = ref('');

function addTask () {
  const text = newTask.value.trim();
  if (text === '') return; // ignore empty tasks
  if (isFull.value) return; // ignore tasks past the limit

  const isDuplicate = props.card.tasks.some(task => task.text.toLowerCase() === text.toLowerCase());
  if (isDuplicate) {
    duplicateError.value = 'This task is already on the checklist.';
    return;
  }
  duplicateError.value = '';

  emit('add', text); // send the new task up to the page
  newTask.value = ''; // clear the box for the next one
}
</script>

<template>
  <div class="modal d-block" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <h2 class="modal-title h5 mb-0">{{ card.title }}</h2>
            <p class="small text-secondary mb-0">{{ card.company }} - {{ card.prep }} done</p>
          </div>
          <button type="button" class="btn-close" v-on:click="emit('close')"></button>
        </div>

        <div class="modal-body">
          <!-- backend error, only shows if saving failed -->
          <div v-if="errorMessage" class="alert alert-danger py-2">
            {{ errorMessage }}
          </div>

          <p v-if="card.tasks.length === 0" class="small text-secondary">
            No tasks yet. Add one below.
          </p>

          <ul class="list-group mb-3">
            <li v-for="(task, index) in card.tasks" :key="index" class="list-group-item d-flex align-items-center gap-2">
              <input type="checkbox" class="form-check-input mt-0" :checked="task.done" :disabled="!task._id" v-on:change="emit('toggle', task)" />
              <span class="flex-grow-1 text-break" :class="{ 'text-decoration-line-through text-secondary': task.done }">{{ task.text }}</span>
              <button type="button" class="btn-link-inturn text-danger" :disabled="!task._id" v-on:click="emit('delete', task)">&#10005;</button>
            </li>
          </ul>

          <!-- add a new task for the checklist -->
          <form class="d-flex gap-2" v-on:submit.prevent="addTask">
            <input v-model="newTask" class="input-inturn" placeholder="e.g. Research the company" :maxlength="MAX_TASK_LENGTH" :disabled="isFull" />
            <button type="submit" class="btn-primary-inturn" :disabled="isFull">Add</button>
          </form>

          <p v-if="duplicateError" class="small text-danger mt-2 mb-0">
            {{ duplicateError }}
          </p>
          <!-- disclaimer for the limit, turns into a warning once it's reached -->
          <p v-if="isFull" class="small text-danger mt-2 mb-0">
            You've reached the limit of {{ MAX_TASKS }} tasks. Delete a task to add another.
          </p>
          <p v-else class="small text-secondary mt-2 mb-0">
            {{ card.tasks.length }} / {{ MAX_TASKS }} tasks, up to {{ MAX_TASK_LENGTH }} characters each.
          </p>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-neutral-inturn" v-on:click="emit('close')">Done</button>
        </div>
      </div>
    </div>
  </div>
  <div class="modal-backdrop show"></div>
</template>