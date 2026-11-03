<script setup>
import { ref, computed } from 'vue';
import { toDateTimeInput } from '../../../helpers/apptrackingboard/KanbanViewHelper';

// for card that needs the updated interviewDate, errorMessage comes from the page if saving fails
defineProps({
  card: Object,
  errorMessage: { type: String, default: '' }
});

const emit = defineEmits(['save', 'skip']);
const interviewDate = ref('');
const now = toDateTimeInput(new Date()); // earliest date the picker allows

// typing can still get past min, so check it too (same format, so the strings compare in date order)
const isPast = computed(() => interviewDate.value !== '' && interviewDate.value < now);

function saveInterviewDate() {
    if (isPast.value) return;
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
          <!-- backend error, only shows if saving failed -->
          <div v-if="errorMessage" class="alert alert-danger py-2">{{ errorMessage }}</div>

          <p class="small text-secondary mb-2">{{ card.title }} · {{ card.company }}</p>
          <input v-model="interviewDate" type="datetime-local" class="input-inturn" :class="{ 'is-invalid': isPast }" :min="now" />
          <div class="invalid-feedback">The interview date can't be in the past.</div>
        </div>
        <div class="modal-footer">
          <button class="btn-neutral-inturn" v-on:click="skipInterviewDate">Skip for now</button>
          <button class="btn-primary-inturn" :disabled="!interviewDate || isPast" v-on:click="saveInterviewDate">Save</button>
        </div>
      </div>
    </div>
  </div>
  <div class="modal-backdrop show"></div>
</template>