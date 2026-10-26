<script setup>
import { ref } from 'vue';

// for card that needs the updated interviewDate
defineProps({ card: Object });

const emit = defineEmits(['save', 'skip']);
const interviewDate = ref('');

function saveInterviewDate() {
    emit('save', new Date(interviewDate.value).toISOString());
}

function skipInterviewDate() {
    emit('skip'); // do nothing
}

</script>

<template>
  <div class="modal d-block" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title h5">Please set the interview date.</h2>
          <button class="btn-close" v-on:click="skipInterviewDate"></button>
        </div>
        <div class="modal-body">
          <p class="small text-secondary mb-2">{{ card.title }} · {{ card.company }}</p>
          <input v-model="interviewDate" type="datetime-local" class="form-control" />
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline-secondary" v-on:click="skipInterviewDate">Skip for now</button>
          <button class="btn btn-primary" :disabled="!interviewDate" v-on:click="saveInterviewDate">Save</button>
        </div>
      </div>
    </div>
  </div>
  <div class="modal-backdrop show"></div>
</template>