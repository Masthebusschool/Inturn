<script setup>
import { ref } from 'vue';

// card is the card whose checklist is open, each task is { _id, text, done }
// errorMessage comes from the page if saving fails
defineProps({
  card: Object,
  errorMessage: { type: String, default: '' }
});

// tells the page what the user did
const emit = defineEmits(['add', 'toggle', 'delete', 'close']);

const newTask = ref(''); // text in the add a task box

function addTask () {
  const text = newTask.value.trim();
  if (text === '') return; // ignore empty tasks

  emit('add', text); // send the new task up to the page
  newTask.value = ''; // clear the box for the next one
}
</script>

<template>
  <div class="modal d-block" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <h2 class="modal-title h5 mb-0">{{ card.title }}</h2>
            <p class="small text-secondary mb-0">{{ card.company }} · {{ card.prep }} done</p>
          </div>
          <button type="button" class="btn-close" v-on:click="emit('close')"></button>
        </div>

        <div class="modal-body">
          <!-- backend error, only shows if saving failed -->
          <div v-if="errorMessage" class="alert alert-danger py-2">{{ errorMessage }}</div>

          <p v-if="card.tasks.length === 0" class="small text-secondary">No tasks yet. Add one below.</p>

          <!-- one row per task with a checkbox, the text and a delete button -->
          <!-- a task has no _id until the backend saves it, so it can't be ticked or deleted yet -->
          <ul class="list-group mb-3">
            <li v-for="(task, index) in card.tasks" :key="index" class="list-group-item d-flex align-items-center gap-2">
              <input type="checkbox" class="form-check-input mt-0" :checked="task.done" :disabled="!task._id" v-on:change="emit('toggle', task)" />
              <span class="flex-grow-1" :class="{ 'text-decoration-line-through text-secondary': task.done }">{{ task.text }}</span>
              <button type="button" class="btn-link-inturn text-danger" :disabled="!task._id" v-on:click="emit('delete', task)">&#10005;</button>
            </li>
          </ul>

          <!-- add a new task -->
          <form class="d-flex gap-2" v-on:submit.prevent="addTask">
            <input v-model="newTask" class="input-inturn" placeholder="e.g. Research the company" maxlength="200" />
            <button type="submit" class="btn-primary-inturn">Add</button>
          </form>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-neutral-inturn" v-on:click="emit('close')">Done</button>
        </div>
      </div>
    </div>
  </div>
  <div class="modal-backdrop show"></div>
</template>