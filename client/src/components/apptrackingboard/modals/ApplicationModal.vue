<script setup>
import { ref } from 'vue';
import { toDateTimeInput } from '../../../helpers/apptrackingboard/KanbanViewHelper';

// error from the page if saving to the backend fails, startStatus is the column whose + was clicked
// card is the card being edited, null when adding a new one
const props = defineProps({
  errorMessage: { type: String, default: '' },
  startStatus: { type: String, default: 'Saved' },
  card: { type: Object, default: null }
});

const emit = defineEmits(['submit', 'cancel']);

const isEdit = props.card !== null;
const card = props.card || {}; // so the prefills below work when adding too

const statuses = ['Saved', 'Applied', 'Interview', 'Offered'];
const today = new Date().toISOString().split('T')[0];
const now = toDateTimeInput(new Date()); // earliest interview date allowed

// job application fields, prefilled from the card when editing
const title = ref(card.title || '');
const companyName = ref(card.company || '');
const expiryDate = ref(card.expiryDate ? card.expiryDate.slice(0, 10) : ''); // 'YYYY-MM-DD' for the date input
const jobDetailsUrl = ref(card.jobDetailsUrl || '');
const skills = ref((card.skills || []).join(', '));
const status = ref(card.status || props.startStatus); // starts in the clicked column (Saved from the top button)
const interviewAt = ref(toDateTimeInput(card.interviewAt)); // only used when status is Interview

// the starting dates, so an edit can keep a date that has already passed
const originalExpiryDate = expiryDate.value;
const originalInterviewAt = interviewAt.value;

const errors = ref({}); // e.g. { title: 'Please enter the internship title.' }

// check the fields, return true if everything is ok
function validate() {
    const newErrors = {};

    if (title.value.trim() === '') newErrors.title = 'Please enter the internship title.';
    if (companyName.value.trim() === '') newErrors.companyName = 'Please enter the company name.';

    if (expiryDate.value === '') {
      newErrors.expiryDate = 'Please pick the application deadline.';
    }
    else if (expiryDate.value < today && expiryDate.value !== originalExpiryDate) {
      newErrors.expiryDate = 'The deadline can\'t be in the past.';
    }

    // same format, so the strings compare in date order
    if (status.value === 'Interview' && interviewAt.value !== '' && interviewAt.value < now && interviewAt.value !== originalInterviewAt) {
      newErrors.interviewAt = 'The interview date can\'t be in the past.';
    }

    const link = jobDetailsUrl.value.trim();
    if (link !== '' && !link.startsWith('http://') && !link.startsWith('https://')) {
        newErrors.jobDetailsUrl = 'Link must start with http:// or https://';
    }

    errors.value = newErrors; // update the ref so the messages show
    const isValid = Object.keys(newErrors).length === 0 // if 0 then no errors
    return isValid; 
}

function submitApplication() {
    if (!validate()) return; // stop and show the errors

    const details = {
        title: title.value.trim(),
        companyName: companyName.value.trim(),
        expiryDate: expiryDate.value,
        jobDetailsUrl: jobDetailsUrl.value.trim(),
        skills: skills.value.split(',').map(
          skill => skill.trim()
        ).filter(skill => skill !== ''), // 'Python, , SQL' -> ['Python', 'SQL']
    };
    const interviewIso = interviewAt.value ? new Date(interviewAt.value).toISOString() : null;

    if (isEdit) {
        // status is changed by moving the card, the interview date is only sent if it changed
        if (status.value === 'Interview' && interviewAt.value !== originalInterviewAt) details.interviewAt = interviewIso;
    } else {
        details.status = status.value;
        details.interviewAt = status.value === 'Interview' ? interviewIso : null;
    }

    emit('submit', details);
}

function cancel() { emit('cancel'); }

</script>

<template>
<div class="modal d-block" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
      <!-- novalidate: show our own messages instead of the browser's pop-ups -->
      <form class="modal-content" novalidate v-on:submit.prevent="submitApplication">
        <div class="modal-header">
          <h2 class="modal-title h5">{{ isEdit ? 'Edit Application' : 'Add Application' }}</h2>
          <button type="button" class="btn-close" v-on:click="cancel"></button>
        </div>

        <div class="modal-body">
          <!-- backend error (only shows if saving failed) -->
          <div v-if="errorMessage" class="alert alert-danger py-2">{{ errorMessage }}</div>

          <div class="mb-3">
            <label class="form-label">Internship title <span class="text-danger">*</span></label>
            <input v-model="title" class="input-inturn" :class="{ 'is-invalid': errors.title }" placeholder="e.g. Software Engineer Intern" maxlength="100" />
            <div class="invalid-feedback">{{ errors.title }}</div>
          </div>

          <div class="mb-3">
            <label class="form-label">Company <span class="text-danger">*</span></label>
            <input v-model="companyName" class="input-inturn" :class="{ 'is-invalid': errors.companyName }" placeholder="e.g. Grab" maxlength="100" />
            <div class="invalid-feedback">{{ errors.companyName }}</div>
          </div>

          <div class="mb-3">
            <label class="form-label">Application deadline <span class="text-danger">*</span></label>
            <input v-model="expiryDate" type="date" class="input-inturn" :class="{ 'is-invalid': errors.expiryDate }" :min="today" />
            <div class="invalid-feedback">{{ errors.expiryDate }}</div>
          </div>

          <!-- adding only, an existing card changes status by moving it -->
          <div v-if="!isEdit" class="mb-3">
            <label class="form-label">Status <span class="text-danger">*</span></label>
            <select v-model="status" class="input-inturn">
              <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>

          <!-- only shown when the card is in Interview -->
          <div v-if="status === 'Interview'" class="mb-3">
            <label class="form-label">Interview date</label>
            <input v-model="interviewAt" type="datetime-local" class="input-inturn" :class="{ 'is-invalid': errors.interviewAt }" :min="now" />
            <div class="invalid-feedback">{{ errors.interviewAt }}</div>
            <div class="form-text">Optional. You can add it later.</div>
          </div>

          <div class="mb-3">
            <label class="form-label">Internship posting link</label>
            <input v-model="jobDetailsUrl" type="url" class="input-inturn" :class="{ 'is-invalid': errors.jobDetailsUrl }" placeholder="https://..." />
            <div class="invalid-feedback">{{ errors.jobDetailsUrl }}</div>
          </div>

          <div class="mb-3">
            <label class="form-label">Skills needed</label>
            <input v-model="skills" class="input-inturn" placeholder="Python, SQL, Git" maxlength="500" />
            <div class="form-text">Separate skills with commas.</div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-neutral-inturn" v-on:click="cancel">Cancel</button>
          <!-- type="submit" already runs submitApplication through the form, no v-on:click needed -->
          <button type="submit" class="btn-primary-inturn">{{ isEdit ? 'Save' : 'Add' }}</button>
        </div>
      </form>
    </div>
  </div>
  <div class="modal-backdrop show"></div>
</template>