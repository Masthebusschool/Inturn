<script setup>
import { ref } from 'vue';

// error from the page if saving to the backend fails
defineProps({ errorMessage: { type: String, default: '' } });

const emit = defineEmits(['submit', 'cancel']);

const statuses = ['Saved', 'Applied', 'Interview', 'Offered'];
const today = new Date().toISOString().split('T')[0]; 

// job application fields to fill up manually
const title = ref('');
const companyName = ref('');
const expiryDate = ref('');
const jobDetailsUrl = ref('');
const skills = ref ('');
const status = ref('Saved'); // default saved bookmark
const interviewAt = ref(''); // only used when status is Interview

const errors = ref({}); // e.g. { title: 'Please enter the job title.' }

// check the fields, return true if everything is ok
function validate() {
    const newErrors = {};

    if (title.value.trim() === '') newErrors.title = 'Please enter the job title.';
    if (companyName.value.trim() === '') newErrors.companyName = 'Please enter the company name.';

    if (expiryDate.value === '') {
      newErrors.expiryDate = 'Please pick the application deadline.';
    }
    else if (expiryDate.value < today) {
      newErrors.expiryDate = 'The deadline can\'t be in the past.';
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

    emit('submit', {
        title: title.value.trim(),
        companyName: companyName.value.trim(),
        expiryDate: expiryDate.value,
        jobDetailsUrl: jobDetailsUrl.value.trim(),
        skills: skills.value.split(',').map(
          skill => skill.trim()
        ).filter(skill => skill !== ''), // 'Python, , SQL' -> ['Python', 'SQL']
        status: status.value,
        interviewAt: status.value === 'Interview' && interviewAt.value ? new Date(interviewAt.value).toISOString() : null
    });
}

function cancel() { emit('cancel'); }

</script>

<template>
<div class="modal d-block" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
      <!-- novalidate: show our own messages instead of the browser's pop-ups -->
      <form class="modal-content" novalidate v-on:submit.prevent="submitApplication">
        <div class="modal-header">
          <h2 class="modal-title h5">Add Application</h2>
          <button type="button" class="btn-close" v-on:click="cancel"></button>
        </div>

        <div class="modal-body">
          <!-- backend error (only shows if saving failed) -->
          <div v-if="errorMessage" class="alert alert-danger py-2">{{ errorMessage }}</div>

          <div class="mb-3">
            <label class="form-label">Job title <span class="text-danger">*</span></label>
            <input v-model="title" class="form-control" :class="{ 'is-invalid': errors.title }" placeholder="e.g. Software Engineer Intern" maxlength="100" />
            <div class="invalid-feedback">{{ errors.title }}</div>
          </div>

          <div class="mb-3">
            <label class="form-label">Company <span class="text-danger">*</span></label>
            <input v-model="companyName" class="form-control" :class="{ 'is-invalid': errors.companyName }" placeholder="e.g. Grab" maxlength="100" />
            <div class="invalid-feedback">{{ errors.companyName }}</div>
          </div>

          <div class="mb-3">
            <label class="form-label">Application deadline <span class="text-danger">*</span></label>
            <input v-model="expiryDate" type="date" class="form-control" :class="{ 'is-invalid': errors.expiryDate }" :min="today" />
            <div class="invalid-feedback">{{ errors.expiryDate }}</div>
          </div>

          <div class="mb-3">
            <label class="form-label">Status <span class="text-danger">*</span></label>
            <select v-model="status" class="form-select">
              <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>

          <!-- only shown when the card starts in Interview -->
          <div v-if="status === 'Interview'" class="mb-3">
            <label class="form-label">Interview date</label>
            <input v-model="interviewAt" type="datetime-local" class="form-control" />
            <div class="form-text">Optional. You can add it later.</div>
          </div>

          <div class="mb-3">
            <label class="form-label">Job posting link</label>
            <input v-model="jobDetailsUrl" type="url" class="form-control" :class="{ 'is-invalid': errors.jobDetailsUrl }" placeholder="https://..." />
            <div class="invalid-feedback">{{ errors.jobDetailsUrl }}</div>
          </div>

          <div class="mb-3">
            <label class="form-label">Skills needed</label>
            <input v-model="skills" class="form-control" placeholder="Python, SQL, Git" maxlength="500" />
            <div class="form-text">Separate skills with commas.</div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" v-on:click="cancel">Cancel</button>
          <!-- type="submit" already runs submitApplication through the form, no v-on:click needed -->
          <button type="submit" class="btn btn-primary">Add</button>
        </div>
      </form>
    </div>
  </div>
  <div class="modal-backdrop show"></div>
</template>