<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { authStore } from '../stores/auth.js'
import ComboboxInput from '../components/profile/ComboboxInput.vue'
import TagInput from '../components/profile/TagInput.vue'
import { EDUCATION_LEVELS, INDUSTRY_OPTIONS, PROFILE_LIMITS } from '../utils/profileOptions.js'
import { FIELD_OF_STUDY_NAMES } from '../utils/fieldsOfStudy.js'
import { isValidEmail, PASSWORD_RULES } from '../utils/validators.js'

const router = useRouter()
const ready = ref(false)

// Each card is its own form with its own errors / success / saving state
const details = reactive({ name: '', educationLevel: '', institution: '', fieldOfStudy: '', targetIndustries: [] })
const detailsErrors = ref([])
const detailsSaved = ref(false)
const detailsSaving = ref(false)

const emailForm = reactive({ email: '', currentPassword: '' })
const emailErrors = ref([])
const emailSaved = ref(false)
const emailSaving = ref(false)

const pw = reactive({ currentPassword: '', password: '', confirmPassword: '' })
const pwErrors = ref([])
const pwSaved = ref(false)
const pwSaving = ref(false)

onMounted(async () => {
  if (!authStore.checked) await authStore.fetchMe()
  if (!authStore.isLoggedIn) return router.replace('/login')
  // No education level yet: onboarding has not been done
  if (!authStore.user.educationLevel) return router.replace('/onboarding')
  const user = authStore.user
  details.name = user.name ?? ''
  details.educationLevel = user.educationLevel ?? ''
  details.institution = user.institution ?? ''
  details.fieldOfStudy = user.fieldOfStudy ?? ''
  details.targetIndustries = [...(user.targetIndustries ?? [])]
  ready.value = true
})

async function saveDetails() {
  detailsSaved.value = false
  const list = []
  const name = details.name.trim()
  if (!name) list.push('Name is required')
  else if (name.length > 50) list.push('Name must not exceed 50 characters')
  if (!details.educationLevel) list.push('Please choose your education level')
  if (details.institution.trim().length > PROFILE_LIMITS.textLength)
    list.push(`Institution must not exceed ${PROFILE_LIMITS.textLength} characters`)
  if (details.fieldOfStudy.trim().length > PROFILE_LIMITS.textLength)
    list.push(`Field of study must not exceed ${PROFILE_LIMITS.textLength} characters`)
  detailsErrors.value = list
  if (list.length) return

  detailsSaving.value = true
  try {
    await authStore.updateProfile({
      name,
      educationLevel: details.educationLevel,
      institution: details.institution.trim(),
      fieldOfStudy: details.fieldOfStudy.trim(),
      targetIndustries: details.targetIndustries,
    })
    detailsSaved.value = true
  } catch (err) {
    detailsErrors.value = err.errors ?? [err.message]
  } finally {
    detailsSaving.value = false
  }
}

async function saveEmail() {
  emailSaved.value = false
  const list = []
  if (!emailForm.email.trim()) list.push('Email is required')
  else if (!isValidEmail(emailForm.email)) list.push('Email format is invalid')
  if (!emailForm.currentPassword) list.push('Enter your current password')
  emailErrors.value = list
  if (list.length) return

  emailSaving.value = true
  try {
    await authStore.changeEmail({ email: emailForm.email.trim(), currentPassword: emailForm.currentPassword })
    emailForm.email = ''
    emailForm.currentPassword = ''
    emailSaved.value = true
  } catch (err) {
    emailErrors.value = err.errors ?? [err.message]
  } finally {
    emailSaving.value = false
  }
}

async function savePassword() {
  pwSaved.value = false
  const list = []
  if (!pw.currentPassword) list.push('Enter your current password')
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(pw.password)) list.push(`Password: ${rule.label.toLowerCase()}`)
  }
  if (pw.confirmPassword !== pw.password) list.push('Confirm password and password do not match')
  pwErrors.value = list
  if (list.length) return

  pwSaving.value = true
  try {
    await authStore.changePassword({ ...pw })
    pw.currentPassword = ''
    pw.password = ''
    pw.confirmPassword = ''
    pwSaved.value = true
  } catch (err) {
    pwErrors.value = err.errors ?? [err.message]
  } finally {
    pwSaving.value = false
  }
}
</script>

<template>
  <section v-if="ready" class="edit-profile-page">
    <header class="page-header">
      <div>
        <h1 class="header-title">Edit profile</h1>
        <p class="header-subtitle">Update your personal details, email and password.</p>
      </div>
      <RouterLink to="/profile" class="btn-neutral-inturn">Back to profile</RouterLink>
    </header>

    <!-- Personal details -->
    <form class="card-inturn edit-card" novalidate @submit.prevent="saveDetails">
      <h2 class="section-title">Personal details</h2>

      <div v-if="detailsErrors.length" class="alert alert-danger py-2" role="alert">
        <div v-for="error in detailsErrors" :key="error">{{ error }}</div>
      </div>
      <div v-if="detailsSaved" class="alert alert-success py-2" role="status">Profile updated</div>

      <div class="mb-3">
        <label for="edit-name" class="form-label">Name</label>
        <input id="edit-name" v-model="details.name" type="text" class="input-inturn" autocomplete="name" maxlength="50" />
      </div>

      <fieldset class="mb-3">
        <legend class="form-label fs-6">Education level</legend>
        <div class="level-options">
          <label
            v-for="level in EDUCATION_LEVELS"
            :key="level"
            class="chip-inturn level-option"
            :class="{ 'is-active': details.educationLevel === level }"
          >
            <input v-model="details.educationLevel" type="radio" name="educationLevel" :value="level" class="visually-hidden" />
            {{ level }}
          </label>
        </div>
      </fieldset>

      <div class="mb-3">
        <label for="edit-institution" class="form-label">Institution</label>
        <input
          id="edit-institution"
          v-model="details.institution"
          type="text"
          class="input-inturn"
          placeholder="e.g. Singapore Management University"
          :maxlength="PROFILE_LIMITS.textLength"
        />
      </div>

      <div class="mb-3">
        <label for="edit-field" class="form-label">Field of study</label>
        <ComboboxInput
          v-model="details.fieldOfStudy"
          input-id="edit-field"
          :options="FIELD_OF_STUDY_NAMES"
          :max-length="PROFILE_LIMITS.textLength"
          placeholder="Search or type your own, e.g. Computer Science"
        />
      </div>

      <div class="mb-4">
        <label for="edit-industries" class="form-label">Target industries <span class="muted">(optional)</span></label>
        <TagInput
          v-model="details.targetIndustries"
          input-id="edit-industries"
          :suggestions="INDUSTRY_OPTIONS"
          :max="PROFILE_LIMITS.industries"
          :max-length="PROFILE_LIMITS.tagLength"
          placeholder="e.g. Technology"
        />
      </div>

      <button type="submit" class="btn-primary-inturn" :disabled="detailsSaving">
        {{ detailsSaving ? 'Saving...' : 'Save details' }}
      </button>
    </form>

    <!-- Email -->
    <form class="card-inturn edit-card" novalidate @submit.prevent="saveEmail">
      <h2 class="section-title">Email</h2>
      <p class="muted">Current email: <strong>{{ authStore.user.email }}</strong></p>

      <div v-if="emailErrors.length" class="alert alert-danger py-2" role="alert">
        <div v-for="error in emailErrors" :key="error">{{ error }}</div>
      </div>
      <div v-if="emailSaved" class="alert alert-success py-2" role="status">Email updated</div>

      <div class="mb-3">
        <label for="edit-email" class="form-label">New email</label>
        <input id="edit-email" v-model="emailForm.email" type="email" class="input-inturn" autocomplete="email" />
      </div>
      <div class="mb-4">
        <label for="edit-email-password" class="form-label">Current password</label>
        <input
          id="edit-email-password"
          v-model="emailForm.currentPassword"
          type="password"
          class="input-inturn"
          autocomplete="current-password"
        />
      </div>

      <button type="submit" class="btn-primary-inturn" :disabled="emailSaving">
        {{ emailSaving ? 'Saving...' : 'Change email' }}
      </button>
    </form>

    <!-- Password -->
    <form class="card-inturn edit-card" novalidate @submit.prevent="savePassword">
      <h2 class="section-title">Password</h2>

      <div v-if="pwErrors.length" class="alert alert-danger py-2" role="alert">
        <div v-for="error in pwErrors" :key="error">{{ error }}</div>
      </div>
      <div v-if="pwSaved" class="alert alert-success py-2" role="status">Password updated</div>

      <div class="mb-3">
        <label for="edit-pw-current" class="form-label">Current password</label>
        <input id="edit-pw-current" v-model="pw.currentPassword" type="password" class="input-inturn" autocomplete="current-password" />
      </div>
      <div class="mb-3">
        <label for="edit-pw-new" class="form-label">New password</label>
        <input
          id="edit-pw-new"
          v-model="pw.password"
          type="password"
          class="input-inturn"
          autocomplete="new-password"
          aria-describedby="edit-password-rules"
        />
        <ul id="edit-password-rules" class="password-rules">
          <li v-for="rule in PASSWORD_RULES" :key="rule.label" :class="{ met: rule.test(pw.password) }">
            {{ rule.test(pw.password) ? '✓' : '•' }} {{ rule.label }}
          </li>
        </ul>
      </div>
      <div class="mb-4">
        <label for="edit-pw-confirm" class="form-label">Confirm new password</label>
        <input id="edit-pw-confirm" v-model="pw.confirmPassword" type="password" class="input-inturn" autocomplete="new-password" />
      </div>

      <button type="submit" class="btn-primary-inturn" :disabled="pwSaving">
        {{ pwSaving ? 'Saving...' : 'Change password' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.edit-card {
  max-width: 640px;
  margin-bottom: 1.25rem;
}

.muted {
  color: var(--inturn-text-muted);
  font-size: 0.9rem;
}

.level-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.6rem;
}

/* Chips stretched to fill the grid cells */
.level-option {
  justify-content: center;
}

.level-option:focus-within {
  box-shadow: 0 0 0 0.2rem rgba(78, 139, 230, 0.25);
}

.password-rules {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  color: var(--inturn-text-muted);
}

.password-rules li.met {
  color: #198754;
}

@media (max-width: 576px) {
  .level-options {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
