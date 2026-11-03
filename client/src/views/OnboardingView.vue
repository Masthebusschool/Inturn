<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { authStore } from "../stores/auth.js";
import { createResumeFromText } from "../api/resume.js";
import TagInput from "../components/profile/TagInput.vue";
import ComboboxInput from "../components/profile/ComboboxInput.vue";
import ResumeUploadBox from "../components/profile/ResumeUploadBox.vue";
import {
  EDUCATION_LEVELS,
  INDUSTRY_OPTIONS,
  PROFILE_LIMITS,
} from "../utils/profileOptions.js";
import {
  FIELD_OF_STUDY_NAMES,
  findFieldOfStudy,
  skillSuggestionsFor,
} from "../utils/fieldsOfStudy.js";

const router = useRouter();
const STEP_LABELS = {
  resume: "Resume",
  education: "Education",
  skills: "Skills",
  industries: "Target industries",
};

const stepIndex = ref(0);
const direction = ref("forward");

const remainingCards = computed(() => steps.value.length - stepIndex.value - 1);
const form = reactive({
  educationLevel: "",
  institution: "",
  fieldOfStudy: "",
  skills: [],
  targetIndustries: [],
});
const errors = ref([]);
const saving = ref(false);
const ready = ref(false);
const isEditing = ref(false);

// The optional resume step only appears for new users; the profile page has its own upload
const steps = computed(() =>
  isEditing.value
    ? ["education", "skills", "industries"]
    : ["education", "skills", "industries", "resume"],
);
const currentStep = computed(() => steps.value[stepIndex.value]);
const isLastStep = computed(() => stepIndex.value === steps.value.length - 1);

// What the resume step found, shown under the upload box
const resumeNote = ref("");
const resumeError = ref("");
const parsing = ref(false);

const skillSuggestions = computed(() => skillSuggestionsFor(form.fieldOfStudy));
const matchedField = computed(() => findFieldOfStudy(form.fieldOfStudy));

// The upload box only extracts text; the AI parser turns it into a saved resume in My Resumes.
// Not awaited by Finish/Skip: the request keeps running after navigation.
async function handleResumeUploaded(resume) {
  parsing.value = true;
  resumeNote.value = "";
  resumeError.value = "";
  try {
    const name = resume.fileName.replace(/\.pdf$/i, "");
    const { resume: saved } = await createResumeFromText({
      name,
      text: resume.text,
    });
    const count = (list, noun) => `${list?.length ?? 0} ${noun}`;
    resumeNote.value = `Saved to My Resumes as "${saved?.name ?? name}" — found ${count(saved?.skills, "skills")}, ${count(saved?.education, "education")} and ${count(saved?.experience, "experience")} entries.`;
  } catch (err) {
    const reason = err.errors?.[0] ?? err.message;
    resumeError.value = `Your file was read, but AI parsing failed (${reason}). You can import it later from My Resumes.`;
  } finally {
    parsing.value = false;
  }
}

onMounted(async () => {
  if (!authStore.checked) await authStore.fetchMe();
  if (!authStore.isLoggedIn) return router.replace("/login");

  // Start from whatever the user already saved (e.g. coming back to finish later)
  const user = authStore.user;
  // Already has an education level: they finished onboarding before, so this is "Edit profile"
  isEditing.value = Boolean(user.educationLevel);
  form.educationLevel = user.educationLevel ?? "";
  form.institution = user.institution ?? "";
  form.fieldOfStudy = user.fieldOfStudy ?? "";
  form.skills = [...(user.skills ?? [])];
  form.targetIndustries = [...(user.targetIndustries ?? [])];
  ready.value = true;
});

// Resume is optional; education level is required, at least one skill; industries can be skipped.
function validateStep() {
  const list = [];
  if (currentStep.value === "education") {
    if (!form.educationLevel) list.push("Please choose your education level");
    if (form.institution.trim().length > PROFILE_LIMITS.textLength)
      list.push(
        `Institution must not exceed ${PROFILE_LIMITS.textLength} characters`,
      );
    if (form.fieldOfStudy.trim().length > PROFILE_LIMITS.textLength)
      list.push(
        `Field of study must not exceed ${PROFILE_LIMITS.textLength} characters`,
      );
  }
  if (currentStep.value === "skills" && form.skills.length === 0)
    list.push("Add at least one skill");
  return list;
}

function next() {
  errors.value = validateStep();

  if (errors.value.length === 0 && !isLastStep.value) {
    direction.value = "forward";
    stepIndex.value++;
  }
}

function back() {
  errors.value = [];

  if (stepIndex.value > 0) {
    direction.value = "backward";
    stepIndex.value--;
  }
}

// "Skip for now" only skips the resume upload; everything already filled in is still saved
async function finish() {
  errors.value = [];
  saving.value = true;
  try {
    await authStore.updateProfile({
      ...form,
      institution: form.institution.trim(),
      fieldOfStudy: form.fieldOfStudy.trim(),
    });
    router.push("/jobs");
  } catch (err) {
    errors.value = err.errors ?? [err.message];
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="onboarding-page">
    <div
      v-if="ready"
      class="stack-container"
      :class="{
        'has-one': remainingCards >= 1,
        'has-two': remainingCards >= 2,
      }"
    >
      <Transition
        :name="direction === 'forward' ? 'card-next' : 'card-back'"
        mode="out-in"
      >
        <div :key="stepIndex" class="card-inturn auth-card">
          <img src="../assets/logogogo.jpg" class="brand-logo" alt="Inturn" />
          <h2 class="welcome text-center">
            {{ isEditing ? "Edit your profile" : "Complete your profile" }}
          </h2>
          <p class="subtitle text-center">
            This helps us personalise jobs, skill-gap analysis and interview
            practice.
          </p>

          <ol class="stepper" aria-label="Progress">
            <li
              v-for="(key, index) in steps"
              :key="key"
              :class="{
                active: stepIndex === index,
                complete: stepIndex > index,
              }"
              :aria-current="stepIndex === index ? 'step' : undefined"
            >
              <span class="dot">{{ stepIndex > index ? "✓" : index + 1 }}</span>
              <span class="label">{{ STEP_LABELS[key] }}</span>
            </li>
          </ol>

          <div
            v-if="errors.length"
            class="alert alert-danger py-2"
            role="alert"
          >
            <div v-for="error in errors" :key="error">{{ error }}</div>
          </div>

          <!-- Resume (optional, new users only) -->
          <div v-if="currentStep === 'resume'" class="mb-3">
            <p class="form-label mb-1">
              Upload your resume <span class="optional">(optional)</span>
            </p>
            <p class="form-text mt-0">
              You can also skip this and add it later from My Resumes.
            </p>
            <ResumeUploadBox @uploaded="handleResumeUploaded" />
            <p v-if="parsing" class="callout-inturn resume-note" role="status">
              <span
                class="spinner-border spinner-border-sm me-2"
                aria-hidden="true"
              ></span
              >Parsing your resume with AI… you can press Finish; it will still
              be saved to My Resumes.
            </p>
            <p
              v-if="resumeNote"
              class="callout-inturn resume-note"
              role="status"
            >
              {{ resumeNote }}
            </p>
            <div
              v-if="resumeError"
              class="alert alert-warning py-2 mt-3 mb-0"
              role="status"
            >
              {{ resumeError }}
            </div>
          </div>

          <!-- Education -->
          <div v-else-if="currentStep === 'education'">
            <fieldset class="mb-3">
              <legend class="form-label fs-6">
                Education level <span class="required">*</span>
              </legend>
              <div class="level-options">
                <label
                  v-for="level in EDUCATION_LEVELS"
                  :key="level"
                  class="chip-inturn level-option"
                  :class="{ 'is-active': form.educationLevel === level }"
                >
                  <input
                    v-model="form.educationLevel"
                    type="radio"
                    name="educationLevel"
                    :value="level"
                    class="visually-hidden"
                  />
                  {{ level }}
                </label>
              </div>
            </fieldset>
            <div class="mb-3">
              <label for="onboarding-institution" class="form-label"
                >Institution <span class="optional">(optional)</span></label
              >
              <input
                id="onboarding-institution"
                v-model="form.institution"
                type="text"
                class="input-inturn"
                placeholder="e.g. Singapore Management University"
                :maxlength="PROFILE_LIMITS.textLength"
              />
            </div>
            <div class="mb-3">
              <label for="onboarding-field" class="form-label"
                >Field of study <span class="optional">(optional)</span></label
              >
              <ComboboxInput
                v-model="form.fieldOfStudy"
                input-id="onboarding-field"
                :options="FIELD_OF_STUDY_NAMES"
                :max-length="PROFILE_LIMITS.textLength"
                placeholder="Search or type your own, e.g. Computer Science"
              />
              <div class="form-text">Pick from the list or type your own.</div>
            </div>
          </div>

          <!-- Skills -->
          <div v-else-if="currentStep === 'skills'" class="mb-3">
            <label for="onboarding-skills" class="form-label"
              >Your skills <span class="required">*</span></label
            >
            <p class="form-text mt-0">
              Add at least one. Type a skill and press Enter, or pick from the
              suggestions. Be specific - Microsoft Excel instead of Excel
              <template v-if="matchedField"
                >Suggestions are based on {{ matchedField.name }}.</template
              >
            </p>
            <TagInput
              v-model="form.skills"
              input-id="onboarding-skills"
              :suggestions="skillSuggestions"
              :max="PROFILE_LIMITS.skills"
              :max-length="PROFILE_LIMITS.tagLength"
              placeholder="e.g. Python"
            />
          </div>

          <!-- Target industries -->
          <div v-else class="mb-3">
            <label for="onboarding-industries" class="form-label"
              >Target industries <span class="optional">(optional)</span></label
            >
            <p class="form-text mt-0">
              Which industries are you aiming for? You can skip this and add
              them later.
            </p>
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
            <button
              v-if="stepIndex > 0"
              type="button"
              class="btn-neutral-inturn"
              :disabled="saving"
              @click="back"
            >
              Back
            </button>
            <RouterLink
              v-else-if="isEditing"
              to="/profile"
              class="btn-neutral-inturn"
              >Cancel</RouterLink
            >
            <span v-else></span>

            <button
              v-if="!isLastStep"
              type="button"
              class="btn-primary-inturn"
              @click="next"
            >
              Next
            </button>
            <div v-else class="d-flex align-items-center gap-3">
              <button
                v-if="!isEditing"
                type="button"
                class="btn-link-inturn"
                :disabled="saving"
                @click="finish()"
              >
                Skip for now
              </button>
              <button
                type="button"
                class="btn-primary-inturn"
                :disabled="saving"
                @click="finish()"
              >
                {{ saving ? "Saving..." : "Finish" }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
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

.brand-logo {
  height: 60px;
  width: auto;
}

.auth-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 640px;
  padding: 2rem 2.75rem;
  background: var(--inturn-surface);
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.1);
}

.welcome {
  font-size: 1.75rem;
  font-weight: 900;
  margin-bottom: 0.75rem;
}

.subtitle {
  font-size: 0.85rem;
  color: var(--inturn-text-muted);
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
  color: var(--inturn-text-muted);
  position: relative;
}

.stack-container {
  position: relative;
  width: 100%;
  max-width: 640px;

  margin: 0 auto 40px;

  isolation: isolate;
}

.stack-container::before,
.stack-container::after {
  content: "";

  position: absolute;
  inset: 0;

  background: white;
  border: 1px solid var(--inturn-border);
  border-radius: var(--r-md);

  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.06);

  pointer-events: none;

  transition:
    transform 0.4s ease,
    opacity 0.4s ease;
}

/* the last one */
.stack-container::before {
  z-index: -2;

  transform: translateY(28px) scale(0.94);
  opacity: 0;
}

/* the middle one */
.stack-container::after {
  z-index: -1;

  transform: translateY(14px) scale(0.97);
  opacity: 0;
}

/* at least got one behind */
.stack-container.has-one::after {
  opacity: 1;
}

/* at least got two behind */
.stack-container.has-two::before {
  opacity: 1;
}

/* Next：current card leave */

.card-next-leave-active {
  transition:
    transform 0.4s ease-in,
    opacity 0.4s ease-in;
}

.card-next-leave-to {
  transform:
    translateX(120px)
    translateY(60px)
    rotate(5deg);

  opacity: 0;
}

/* Next：new card enter */

.card-next-enter-active {
  transition:
    transform 0.4s ease-out,
    opacity 0.4s ease-out;
}

.card-next-enter-from {
  transform:
    translateY(24px)
    scale(0.96);

  opacity: 0;
}

/* Back：current card dissapear */

.card-back-leave-active {
  transition:
    transform 0.35s ease-in,
    opacity 0.35s ease-in;
}

.card-back-leave-to {
  transform:
    translateY(35px)
    scale(0.95);

  opacity: 0;
}

/* Back：last card enter */

.card-back-enter-active {
  transition:
    transform 0.4s ease-out,
    opacity 0.4s ease-out;
}

.card-back-enter-from {
  transform:
    translateX(100px)
    rotate(4deg);

  opacity: 0;
}

/* Line between the dots */
.stepper li:not(:first-child)::before {
  content: "";
  position: absolute;
  top: 15px;
  right: 50%;
  width: 100%;
  height: 2px;
  background: var(--inturn-border-strong);
  z-index: 0;
}

.stepper li.complete + li::before,
.stepper li.active:not(:first-child)::before {
  background: var(--inturn-primary);
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
  background: var(--inturn-surface);
  border: 2px solid var(--inturn-border-strong);
  font-weight: 600;
}

.stepper li.active,
.stepper li.complete {
  color: var(--inturn-primary-hover);
  font-weight: 600;
}

.stepper li.active .dot {
  border-color: var(--inturn-primary);
  color: var(--inturn-primary);
}

.stepper li.complete .dot {
  background: var(--inturn-primary);
  border-color: var(--inturn-primary);
  color: #fff;
}

.required {
  color: var(--inturn-danger);
}

.optional {
  color: var(--inturn-text-muted);
  font-size: 0.85rem;
}

.resume-note {
  margin: 0.75rem 0 0;
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

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.75rem;
}

@media (max-width: 576px) {
  .auth-card {
    padding: 1.5rem 1.25rem;
  }

  .level-options {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
