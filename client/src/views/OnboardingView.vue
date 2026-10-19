<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { authStore } from '../stores/auth.js'
import TagInput from '../components/profile/TagInput.vue'
import { EDUCATION_LEVELS, SKILL_SUGGESTIONS, INDUSTRY_OPTIONS, PROFILE_LIMITS } from '../utils/profileOptions.js'

const router = useRouter()
const STEPS = ['Education', 'Skills', 'Target industries']

const step = ref(1)
const form = reactive({
  educationLevel: '',
  institution: '',
  fieldOfStudy: '',
  skills: [],
  targetIndustries: [],
})
const errors = ref([])
const saving = ref(false)
const ready = ref(false)
// Temporary: "Edit profile" reuses these steps until a dedicated edit page exists
const isEditing = ref(false)

onMounted(async () => {
  if (!authStore.checked) await authStore.fetchMe()
  if (!authStore.isLoggedIn) return router.replace({ name: 'login' })

  // Start from whatever the user already saved (e.g. coming back to finish later)
  const user = authStore.user
  isEditing.value = user.profileComplete
  form.educationLevel = user.educationLevel ?? ''
  form.institution = user.institution ?? ''
  form.fieldOfStudy = user.fieldOfStudy ?? ''
  form.skills = [...(user.skills ?? [])]
  form.targetIndustries = [...(user.targetIndustries ?? [])]
  ready.value = true
})

// Education level is required, at least one skill; industries can be skipped.
function validateStep() {
  const list = []
  if (step.value === 1) {
    if (!form.educationLevel) list.push('Please choose your education level')
    if (form.institution.trim().length > PROFILE_LIMITS.textLength)
      list.push(`Institution must not exceed ${PROFILE_LIMITS.textLength} characters`)
    if (form.fieldOfStudy.trim().length > PROFILE_LIMITS.textLength)
      list.push(`Field of study must not exceed ${PROFILE_LIMITS.textLength} characters`)
  }
  if (step.value === 2 && form.skills.length === 0) list.push('Add at least one skill')
  return list
}

function next() {
  errors.value = validateStep()
  if (errors.value.length === 0) step.value++
}

function back() {
  errors.value = []
  step.value--
}

async function finish(skipIndustries = false) {
  errors.value = []
  saving.value = true
  try {
    await authStore.updateProfile({
      ...form,
      institution: form.institution.trim(),
      fieldOfStudy: form.fieldOfStudy.trim(),
      targetIndustries: skipIndustries ? [] : form.targetIndustries,
    })
    router.push({ name: 'profile' })
  } catch (err) {
    errors.value = err.errors ?? [err.message]
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="onboarding-page">
    <h1 class="brand">Inturn</h1>

    <div v-if="ready" class="onboarding-card">
      <h2 class="welcome text-center">{{ isEditing ? 'Edit your profile' : 'Complete your profile' }}</h2>
      <p class="subtitle text-center">This helps us personalise jobs, skill-gap analysis and interview practice.</p>

      <ol class="stepper" aria-label="Progress">
        <li
          v-for="(label, index) in STEPS"
          :key="label"
          :class="{ active: step === index + 1, complete: step > index + 1 }"
          :aria-current="step === index + 1 ? 'step' : undefined"
        >
          <span class="dot">{{ step > index + 1 ? '✓' : index + 1 }}</span>
          <span class="label">{{ label }}</span>
        </li>
      </ol>

      <div v-if="errors.length" class="alert alert-danger py-2" role="alert">
        <div v-for="error in errors" :key="error">{{ error }}</div>
      </div>

      <!-- Step 1: Education -->
      <div v-if="step === 1">
        <fieldset class="mb-3">
          <legend class="form-label fs-6">Education level <span class="required">*</span></legend>
          <div class="level-options">
            <label v-for="level in EDUCATION_LEVELS" :key="level" class="level-option" :class="{ selected: form.educationLevel === level }">
              <input v-model="form.educationLevel" type="radio" name="educationLevel" :value="level" class="visually-hidden" />
              {{ level }}
            </label>
          </div>
        </fieldset>
        <div class="mb-3">
          <label for="onboarding-institution" class="form-label">Institution <span class="optional">(optional)</span></label>
          <input
            id="onboarding-institution"
            v-model="form.institution"
            type="text"
            class="form-control input-inturn"
            placeholder="e.g. Singapore Management University"
            :maxlength="PROFILE_LIMITS.textLength"
          />
        </div>
        <div class="mb-3">
          <label for="onboarding-field" class="form-label">Field of study <span class="optional">(optional)</span></label>
          <input
            id="onboarding-field"
            v-model="form.fieldOfStudy"
            type="text"
            class="form-control input-inturn"
            placeholder="e.g. Software Engineering"
            :maxlength="PROFILE_LIMITS.textLength"
          />
        </div>
      </div>

      <!-- Step 2: Skills -->
      <div v-else-if="step === 2" class="mb-3">
        <label for="onboarding-skills" class="form-label">Your skills <span class="required">*</span></label>
        <p class="form-text mt-0">Add at least one. Type a skill and press Enter, or pick from the suggestions.</p>
        <TagInput
          v-model="form.skills"
          input-id="onboarding-skills"
          :suggestions="SKILL_SUGGESTIONS"
          :max="PROFILE_LIMITS.skills"
          :max-length="PROFILE_LIMITS.tagLength"
          placeholder="e.g. Python"
        />
      </div>

      <!-- Step 3: Target industries -->
      <div v-else class="mb-3">
        <label for="onboarding-industries" class="form-label">Target industries <span class="optional">(optional)</span></label>
        <p class="form-text mt-0">Which industries are you aiming for? You can skip this and add them later.</p>
        <TagInput
          v-model="form.targetIndustries"
          input-id="onboarding-industries"
          :suggestions="INDUSTRY_OPTIONS"
          :max="PROFILE_LIMITS.industries"
          :max-length="PROFILE_LIMITS.tagLength"
          placeholder="e.g. Technology"
        />
      </div>

      <div class="actions">
        <button v-if="step > 1" type="button" class="btn-outline-inturn" :disabled="saving" @click="back">Back</button>
        <RouterLink v-else-if="isEditing" :to="{ name: 'profile' }" class="link-secondary">Cancel</RouterLink>
        <span v-else></span>

        <button v-if="step < 3" type="button" class="btn-primary-inturn" @click="next">Next</button>
        <div v-else class="d-flex align-items-center gap-3">
          <button v-if="!isEditing" type="button" class="btn btn-link link-secondary p-0" :disabled="saving" @click="finish(true)">Skip for now</button>
          <button type="button" class="btn-primary-inturn" :disabled="saving" @click="finish()">
            {{ saving ? 'Saving...' : 'Finish' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.onboarding-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 0;
}

.brand {
  font-size: 3rem;
  font-weight: 400;
  margin-bottom: 2rem;
}

.onboarding-card {
  width: 100%;
  max-width: 640px;
  padding: 2rem 2.75rem;
  background: #f3f3f3;
  border: 1px solid #4e8be6;
  border-radius: 16px;
}

.welcome {
  font-size: 1.75rem;
  font-weight: 900;
  margin-bottom: 0.75rem;
}

.subtitle {
  font-size: 0.85rem;
  color: #6c757d;
  margin-bottom: 1.5rem;
}

.stepper {
  display: flex;
  justify-content: space-between;
  list-style: none;
  padding: 0;
  margin: 0 0 1.75rem;
  counter-reset: none;
}

.stepper li {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: #6c757d;
  position: relative;
}

/* Line between the dots */
.stepper li:not(:first-child)::before {
  content: '';
  position: absolute;
  top: 15px;
  right: 50%;
  width: 100%;
  height: 2px;
  background: #ced4da;
  z-index: 0;
}

.stepper li.complete + li::before,
.stepper li.active:not(:first-child)::before {
  background: #4e8be6;
}

.stepper .dot {
  position: relative;
  z-index: 1;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 2px solid #ced4da;
  font-weight: 600;
}

.stepper li.active,
.stepper li.complete {
  color: #3c70b3;
  font-weight: 600;
}

.stepper li.active .dot {
  border-color: #4e8be6;
  color: #4e8be6;
}

.stepper li.complete .dot {
  background: #4e8be6;
  border-color: #4e8be6;
  color: #fff;
}

.required {
  color: #dc3545;
}

.optional {
  color: #6c757d;
  font-size: 0.85rem;
}

.level-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem;
}

.level-option {
  padding: 0.75rem 0.5rem;
  text-align: center;
  background: #fff;
  border: 1px solid #222;
  border-radius: 12px;
  cursor: pointer;
}

.level-option.selected {
  background: #e3ecfb;
  border: 2px solid #4e8be6;
  color: #3c70b3;
  font-weight: 600;
}

.level-option:focus-within {
  box-shadow: 0 0 0 0.2rem rgba(78, 139, 230, 0.25);
}

.input-inturn {
  border: 1px solid #222;
  border-radius: 12px;
  padding: 0.65rem 0.9rem;
}

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.75rem;
}

.btn-primary-inturn {
  background: #4e8be6;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 0.5rem 2rem;
  font-size: 1.05rem;
}

.btn-primary-inturn:hover:not(:disabled) {
  background: #3c70b3;
}

.btn-outline-inturn {
  background: transparent;
  color: #3c70b3;
  border: 1px solid #4e8be6;
  border-radius: 10px;
  padding: 0.5rem 1.5rem;
}

.btn-primary-inturn:disabled,
.btn-outline-inturn:disabled {
  opacity: 0.7;
}

@media (max-width: 576px) {
  .onboarding-card {
    padding: 1.5rem 1.25rem;
  }

  .level-options {
    grid-template-columns: 1fr;
  }
}
</style>
