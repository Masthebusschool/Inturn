<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { authStore } from '../stores/auth.js'
import { getActivity } from '../api/profile.js'
import { getPrimaryResume, updatePrimaryResume } from '../api/resume.js'
import { setMatchingFromResume } from '../stores/jobMatch.js'
import { PROFILE_LIMITS } from '../utils/profileOptions.js'
import { skillSuggestionsFor } from '../utils/fieldsOfStudy.js'
import { canonical } from '../utils/skillNormalize.js'
import TagInput from '../components/profile/TagInput.vue'
import ResumeEntriesCard from '../components/profile/ResumeEntriesCard.vue'

const router = useRouter()
const ready = ref(false)

const user = computed(() => authStore.user)

// ---- Primary (profile) resume: skills, projects and experience live here ----
const primary = ref(null)
const primaryLoading = ref(true)
const primaryError = ref('')
const skills = ref([])
const skillsStatus = ref('') // 'saving' | 'saved' | error text
const skillsFailed = ref(false)

// One queue so saves never overlap: keeps them in order and avoids creating "My Profile" twice
let queue = Promise.resolve()
function savePrimary(fields) {
  const run = queue.then(() => updatePrimaryResume(fields))
  queue = run.catch(() => {})
  return run.then(({ resume }) => {
    primary.value = resume
    setMatchingFromResume(resume)
    return resume
  })
}

let skillsEdit = 0
async function saveSkills(list) {
  const edit = ++skillsEdit
  skills.value = list
  skillsStatus.value = 'saving'
  skillsFailed.value = false
  try {
    await savePrimary({ skills: list })
    // A newer edit may have been queued meanwhile; only the latest one reports "Saved"
    if (edit === skillsEdit) skillsStatus.value = 'saved'
  } catch (e) {
    skillsFailed.value = true
    skillsStatus.value = e.errors?.[0] ?? e.message ?? 'Could not save skills.'
    skills.value = [...(primary.value?.skills ?? [])]
  }
}

// ---- Activity (loaded after the page is shown) ----
const activity = ref(null)
const activityLoading = ref(true)
const activityError = ref('')

const memberSince = computed(() =>
  activity.value?.joinedAt
    ? new Date(activity.value.joinedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : ''
)
const lastLogin = computed(() =>
  activity.value?.lastLoginAt
    ? new Date(activity.value.lastLoginAt).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : ''
)

const stats = computed(() => {
  const s = activity.value?.stats
  return [
    { label: 'Jobs tracked', value: s?.total ?? 0 },
    { label: 'Applied', value: s?.submitted ?? 0 },
    { label: 'Interviews', value: s?.byStatus?.Interview ?? 0 },
    { label: 'Offers', value: s?.byStatus?.Offered ?? 0 },
  ]
})

// ---- Heatmap: 26 weeks, columns = weeks (oldest left), rows = Sun..Sat, local timezone ----
const WEEKS = 26
const dateKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
const dayLabel = (d) =>
  d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const levelFor = (n) => (n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4)

const heatmap = computed(() => {
  const counts = new Map()
  for (const iso of activity.value?.applicationDates ?? []) {
    const key = dateKey(new Date(iso))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() - (WEEKS - 1) * 7)

  const cells = []
  let total = 0
  for (let i = 0; i < WEEKS * 7; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    if (date > today) {
      cells.push({ key: i, future: true })
      continue
    }
    const count = counts.get(dateKey(date)) ?? 0
    total += count
    cells.push({
      key: i,
      level: levelFor(count),
      title: `${count} ${count === 1 ? 'application' : 'applications'} on ${dayLabel(date)}`,
    })
  }

  // A month label sits above the first week column whose Sunday starts a new month
  const months = []
  let lastMonth = -1
  for (let w = 0; w < WEEKS; w++) {
    const sunday = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7)
    if (sunday.getMonth() !== lastMonth) {
      lastMonth = sunday.getMonth()
      // A label needs ~3 columns; drop the earlier one (e.g. a partial first month) if they'd overlap
      if (months.length && w + 1 - months[months.length - 1].column < 3) months.pop()
      months.push({ column: w + 1, label: sunday.toLocaleDateString('en-GB', { month: 'short' }) })
    }
  }

  return { cells, months, total }
})

onMounted(async () => {
  if (!authStore.checked) await authStore.fetchMe()
  if (!authStore.isLoggedIn) return router.replace('/login')
  // No education level yet: onboarding has not been done
  if (!authStore.user.educationLevel) return router.replace('/onboarding')
  ready.value = true

  await Promise.all([
    getActivity()
      .then((data) => { activity.value = data })
      .catch((e) => { activityError.value = e.errors?.[0] ?? e.message ?? 'Could not load activity.' })
      .finally(() => { activityLoading.value = false }),
    getPrimaryResume()
      .then(({ resume }) => {
        primary.value = resume
        skills.value = [...(resume?.skills ?? [])]
      })
      .catch((e) => { primaryError.value = e.errors?.[0] ?? e.message ?? 'Could not load your profile resume.' })
      .finally(() => { primaryLoading.value = false }),
  ])
})

// ---- Delete profile ----
const dialog = ref(null)
const typedEmail = ref('')
const deleteError = ref('')
const deleting = ref(false)

const emailMatches = computed(
  () => !!user.value && typedEmail.value.trim().toLowerCase() === user.value.email.toLowerCase()
)

function openDeleteDialog() {
  dialog.value?.showModal()
}

function closeDeleteDialog() {
  dialog.value?.close()
}

function resetDeleteDialog() {
  typedEmail.value = ''
  deleteError.value = ''
}

async function confirmDelete() {
  if (!emailMatches.value || deleting.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await authStore.deleteAccount(typedEmail.value)
    router.replace({ name: 'login' })
  } catch (e) {
    deleteError.value = e.errors?.[0] ?? e.message ?? 'Could not delete your profile.'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <section v-if="ready && user" class="profile-page">
    <header class="page-header">
      <div>
        <h1 class="header-title">My Profile</h1>
        <p class="header-subtitle">Manage your personal information and career preferences.</p>
      </div>
      <button type="button" class="btn-secondary-inturn" @click="router.push('/profile/edit')">
        <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M11.5 1.5a1.4 1.4 0 0 1 2 2L5 12l-3 1 1-3z" fill="currentColor" />
        </svg>
        Edit profile
      </button>
    </header>

    <article class="card-inturn profile-card identity">
      <div class="avatar" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
        </svg>
      </div>
      <div class="identity-text">
        <h2 class="name">{{ user.name }}</h2>
        <p class="muted mb-0">{{ user.email }}</p>
        <dl class="details">
          <div>
            <dt>Level</dt>
            <dd v-if="user.educationLevel">{{ user.educationLevel }}</dd>
            <dd v-else class="muted">Not added yet</dd>
          </div>
          <div>
            <dt>Institution</dt>
            <dd v-if="user.institution">{{ user.institution }}</dd>
            <dd v-else class="muted">Not added yet</dd>
          </div>
          <div>
            <dt>Field of study</dt>
            <dd v-if="user.fieldOfStudy">{{ user.fieldOfStudy }}</dd>
            <dd v-else class="muted">Not added yet</dd>
          </div>
        </dl>
        <dl class="details details-industries">
          <div>
            <dt>Target industries</dt>
            <dd v-if="user.targetIndustries?.length" class="industry-tags">
              <span v-for="industry in user.targetIndustries" :key="industry" class="tag-inturn">{{ industry }}</span>
            </dd>
            <dd v-else class="muted">Not added yet</dd>
          </div>
        </dl>
        <p v-if="memberSince || lastLogin" class="muted small-note mb-0">
          <span v-if="memberSince">Member since {{ memberSince }}</span>
          <span v-if="memberSince && lastLogin"> · </span>
          <span v-if="lastLogin">Last login {{ lastLogin }}</span>
        </p>
      </div>
    </article>

    <p v-if="primaryError" class="muted">Could not load your profile resume: {{ primaryError }}</p>
    <p v-else-if="!primaryLoading" class="muted">
      <template v-if="primary">
        Skills, projects and experience are saved to your profile resume
        <RouterLink :to="`/resumes/${primary._id}`">{{ primary.name }}</RouterLink>
        and used for job matching and Skill Gap.
      </template>
      <template v-else>Anything you add here creates your profile resume in My Resumes.</template>
    </p>

    <div class="profile-grid">
      <article class="card-inturn">
        <h2 class="section-title">Skills</h2>
        <p v-if="primaryLoading" class="muted mb-0">Loading…</p>
        <p v-else-if="primaryError" class="muted mb-0">Unavailable right now.</p>
        <template v-else>
          <TagInput
            :model-value="skills"
            input-id="profile-skills"
            :suggestions="skillSuggestionsFor(user.fieldOfStudy)"
            :max="PROFILE_LIMITS.skills"
            :max-length="PROFILE_LIMITS.tagLength"
            :normalize="canonical"
            placeholder="e.g. Python"
            @update:model-value="saveSkills"
          />
          <p v-if="skillsStatus" class="small mt-2 mb-0" :class="skillsFailed ? 'text-danger' : 'text-body-secondary'" role="status">
            {{ skillsStatus === 'saving' ? 'Saving…' : skillsStatus === 'saved' ? 'Saved' : skillsStatus }}
          </p>
        </template>
      </article>

      <template v-if="primaryLoading || primaryError">
        <article v-for="title in ['Personal projects', 'Experience']" :key="title" class="card-inturn">
          <h2 class="section-title">{{ title }}</h2>
          <p class="muted mb-0">{{ primaryLoading ? 'Loading…' : 'Unavailable right now.' }}</p>
        </article>
      </template>
      <template v-else>
        <ResumeEntriesCard kind="projects" title="Personal projects" :entries="primary?.projects ?? []" :save="(list) => savePrimary({ projects: list })" />
        <ResumeEntriesCard kind="experience" title="Experience" :entries="primary?.experience ?? []" :save="(list) => savePrimary({ experience: list })" />
      </template>

      <article class="card-inturn">
        <h2 class="section-title">Activity</h2>
        <p v-if="activityLoading" class="muted mb-0">Loading activity...</p>
        <p v-else-if="activityError" class="muted mb-0">Could not load activity: {{ activityError }}</p>
        <template v-else>
          <div class="stat-grid">
            <div v-for="stat in stats" :key="stat.label" class="card-muted-inturn">
              <div class="stat-value">{{ stat.value }}</div>
              <div class="stat-label">{{ stat.label }}</div>
            </div>
          </div>

          <p v-if="activity.stats.total === 0" class="muted mb-0 mt-3">
            No tracked applications yet — jobs you add to the Tracker Board show up here.
          </p>

          <div class="heatmap">
            <div class="heatmap-months" aria-hidden="true">
              <span
                v-for="m in heatmap.months"
                :key="m.column"
                class="heatmap-month"
                :style="{ gridColumn: m.column }"
              >{{ m.label }}</span>
            </div>
            <div
              class="heatmap-grid"
              role="img"
              :aria-label="`${heatmap.total} applications in the last 26 weeks`"
            >
              <span
                v-for="cell in heatmap.cells"
                :key="cell.key"
                class="heatmap-cell"
                :class="cell.future ? 'is-future' : `level-${cell.level}`"
                :title="cell.future ? undefined : cell.title"
              ></span>
            </div>
            <div class="heatmap-legend" aria-hidden="true">
              <span>Less</span>
              <span v-for="n in 5" :key="n" class="heatmap-cell" :class="`level-${n - 1}`"></span>
              <span>More</span>
            </div>
          </div>
        </template>
      </article>
    </div>

    <article class="card-inturn profile-card danger-card">
      <h2 class="section-title">Delete profile</h2>
      <p class="danger-text">
        Permanently deletes your account, profile, resumes, skill-gap results, learning tasks and tracked
        applications. Your Interview Intel posts stay but become anonymous. This cannot be undone.
      </p>
      <button type="button" class="btn-danger-inturn" @click="openDeleteDialog">Delete profile…</button>
    </article>

    <!-- @cancel: Escape must not close the dialog while the delete request is in flight -->
    <dialog
      ref="dialog"
      class="delete-dialog"
      aria-labelledby="delete-title"
      @cancel="deleting && $event.preventDefault()"
      @close="resetDeleteDialog"
    >
      <form @submit.prevent="confirmDelete">
        <h2 id="delete-title" class="dialog-title">Delete your profile?</h2>
        <p class="danger-text">
          Permanently deletes your account, profile, resumes, skill-gap results, learning tasks and tracked
          applications. Your Interview Intel posts stay but become anonymous. This cannot be undone.
        </p>
        <label for="confirm-email" class="form-label">Type your email ({{ user.email }}) to confirm</label>
        <input
          id="confirm-email"
          v-model="typedEmail"
          type="text"
          class="input-inturn"
          autocomplete="off"
          :disabled="deleting"
        />
        <div v-if="deleteError" class="alert alert-danger py-2 mt-3 mb-0" role="alert">{{ deleteError }}</div>
        <div class="dialog-actions">
          <button type="button" class="btn-neutral-inturn" :disabled="deleting" @click="closeDeleteDialog">
            Cancel
          </button>
          <button type="submit" class="btn-danger-inturn" :disabled="!emailMatches || deleting">
            {{ deleting ? 'Deleting…' : 'Permanently delete' }}
          </button>
        </div>
      </form>
    </dialog>
  </section>
</template>

<style scoped>
.profile-card {
  margin-bottom: 1.25rem;
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
  margin-bottom: 1.25rem;
}

.identity {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

/* Long emails wrap instead of overflowing the card on phones */
.identity-text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.avatar {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--inturn-primary-soft);
  color: var(--inturn-text);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar svg {
  width: 28px;
  height: 28px;
}

.name {
  font-size: 1.35rem;
  font-weight: 700;
  margin-bottom: 0.2rem;
}

.muted {
  color: var(--inturn-text-muted);
  font-size: 0.9rem;
}

.small-note {
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.details {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 2rem;
  margin: 0.75rem 0 0.5rem;
}

.details dt {
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--inturn-text-muted);
}

/* Sits right under the first row of details */
.details-industries {
  margin-top: 0;
}

.industry-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.details dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.icon {
  width: 16px;
  height: 16px;
}

/* Activity */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
}

.stat-label {
  font-size: 0.8rem;
  color: var(--inturn-text-muted);
}

/* Half-width card: scroll sideways on very narrow cells rather than squash the 26 weeks */
.heatmap {
  margin-top: 1.25rem;
  overflow-x: auto;
}

.heatmap-months,
.heatmap-grid,
.heatmap-legend {
  min-width: 300px;
}

.heatmap-months,
.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(26, 1fr);
  gap: 3px;
}

.heatmap-months {
  margin-bottom: 4px;
  font-size: 0.7rem;
  color: var(--inturn-text-muted);
}

.heatmap-month {
  white-space: nowrap;
}

.heatmap-grid {
  grid-template-rows: repeat(7, 1fr);
  grid-auto-flow: column;
}

.heatmap-cell {
  aspect-ratio: 1;
  border-radius: 2px;
  background: #ebedf0;
}

.heatmap-cell.level-0 { background: #ebedf0; }
.heatmap-cell.level-1 { background: #c6dbf7; }
.heatmap-cell.level-2 { background: #8fb6ee; }
.heatmap-cell.level-3 { background: var(--inturn-primary); }
.heatmap-cell.level-4 { background: #2f5f9e; }
.heatmap-cell.is-future { visibility: hidden; }

.heatmap-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  margin-top: 0.5rem;
  font-size: 0.7rem;
  color: var(--inturn-text-muted);
}

.heatmap-legend .heatmap-cell {
  width: 12px;
}

.heatmap-legend span:first-child {
  margin-right: 3px;
}

.heatmap-legend span:last-child {
  margin-left: 3px;
}

/* Danger zone */
.danger-card {
  border-color: #f1aeb5;
}

.danger-text {
  font-size: 0.9rem;
  color: var(--inturn-text-soft);
}

.delete-dialog {
  width: calc(100% - 2rem);
  max-width: 440px;
  padding: 1.5rem;
  border: none;
  border-radius: var(--r-md);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
}

.delete-dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
}

.dialog-title {
  font-size: 1.15rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.25rem;
}

@media (max-width: 576px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }

  .identity {
    gap: 1rem;
  }
}
</style>
