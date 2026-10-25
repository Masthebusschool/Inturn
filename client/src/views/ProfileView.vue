<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { authStore } from '../stores/auth.js'
import { notificationStore } from '../stores/notifications.js'
import { getActivity } from '../api/profile.js'

const router = useRouter()
const ready = ref(false)

const user = computed(() => authStore.user)
// e.g. "Undergraduate student | Software Engineering"
const studyLine = computed(() =>
  [user.value?.educationLevel && `${user.value.educationLevel} student`, user.value?.fieldOfStudy]
    .filter(Boolean)
    .join(' | ')
)

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

  try {
    activity.value = await getActivity()
  } catch (e) {
    activityError.value = e.errors?.[0] ?? e.message ?? 'Could not load activity.'
  } finally {
    activityLoading.value = false
  }
})

// TODO(edit profile step): point to a dedicated edit page once it exists.
function editProfile() {
  router.push('/onboarding')
}

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
    notificationStore.clear()
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
      <button type="button" class="btn-primary-inturn" @click="editProfile">
        <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M11.5 1.5a1.4 1.4 0 0 1 2 2L5 12l-3 1 1-3z" fill="currentColor" />
        </svg>
        Edit profile
      </button>
    </header>

    <article class="profile-card identity">
      <div class="avatar" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
        </svg>
      </div>
      <div class="identity-text">
        <h2 class="name">{{ user.name }}</h2>
        <p class="muted mb-0">{{ user.email }}</p>
        <p v-if="studyLine" class="muted mb-0">{{ studyLine }}</p>
        <p v-if="memberSince || lastLogin" class="muted small-note mb-0">
          <span v-if="memberSince">Member since {{ memberSince }}</span>
          <span v-if="memberSince && lastLogin"> · </span>
          <span v-if="lastLogin">Last login {{ lastLogin }}</span>
        </p>
      </div>
    </article>

    <div class="card-grid">
      <article class="profile-card">
        <h2 class="section-title">Education</h2>
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
      </article>

      <article class="profile-card">
        <h2 class="section-title">Target industries</h2>
        <ul v-if="user.targetIndustries?.length" class="skill-list">
          <li v-for="industry in user.targetIndustries" :key="industry" class="skill">{{ industry }}</li>
        </ul>
        <p v-else class="muted mb-0">No target industries added yet.</p>
      </article>
    </div>

    <article class="profile-card">
      <h2 class="section-title">Skills</h2>
      <ul v-if="user.skills?.length" class="skill-list">
        <li v-for="skill in user.skills" :key="skill" class="skill">{{ skill }}</li>
      </ul>
      <p v-else class="muted mb-0">No skills added yet.</p>
    </article>

    <article class="profile-card">
      <h2 class="section-title">Activity</h2>
      <p v-if="activityLoading" class="muted mb-0">Loading activity...</p>
      <p v-else-if="activityError" class="muted mb-0">Could not load activity: {{ activityError }}</p>
      <template v-else>
        <div class="stat-grid">
          <div v-for="stat in stats" :key="stat.label" class="stat-tile">
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

    <article class="danger-card">
      <h2 class="section-title">Delete profile</h2>
      <p class="danger-text">
        Permanently deletes your account, profile, resumes, skill-gap results, learning tasks and tracked
        applications. Your Interview Intel posts stay but become anonymous. This cannot be undone.
      </p>
      <button type="button" class="btn btn-outline-danger" @click="openDeleteDialog">Delete profile…</button>
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
          class="form-control"
          autocomplete="off"
          :disabled="deleting"
        />
        <div v-if="deleteError" class="alert alert-danger py-2 mt-3 mb-0" role="alert">{{ deleteError }}</div>
        <div class="dialog-actions">
          <button type="button" class="btn btn-outline-secondary" :disabled="deleting" @click="closeDeleteDialog">
            Cancel
          </button>
          <button type="submit" class="btn btn-danger" :disabled="!emailMatches || deleting">
            {{ deleting ? 'Deleting…' : 'Permanently delete' }}
          </button>
        </div>
      </form>
    </dialog>
  </section>
</template>

<style scoped>
.profile-page {
  max-width: 760px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 8px;
}

.header-title {
  font-size: 1.15rem;
  font-weight: 700;
  margin-bottom: 0.15rem;
}

.header-subtitle {
  font-size: 0.8rem;
  margin-bottom: 0;
}

.profile-card {
  padding: 1.5rem;
  margin-bottom: 1.25rem;
  background: #f3f3f3;
  border-radius: 20px;
}

.card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 1.25rem;
}

.identity {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.avatar {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #dde7f8;
  color: #212529;
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
  color: #6c757d;
  font-size: 0.9rem;
}

.small-note {
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.details {
  margin: 0;
}

.details > div + div {
  margin-top: 0.6rem;
}

.details dt {
  font-size: 0.8rem;
  font-weight: 400;
  color: #6c757d;
}

.details dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.skill-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.skill {
  padding: 0.3rem 0.85rem;
  background: #e3ecfb;
  color: #3c70b3;
  border-radius: 999px;
  font-size: 0.85rem;
}

.btn-primary-inturn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #4e8be6;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 0.5rem 1.25rem;
  white-space: nowrap;
}

.btn-primary-inturn:hover {
  background: #3c70b3;
}

.icon {
  width: 16px;
  height: 16px;
}

/* Activity */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}

.stat-tile {
  padding: 0.75rem 0.9rem;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 12px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
}

.stat-label {
  font-size: 0.8rem;
  color: #6c757d;
}

.heatmap {
  margin-top: 1.25rem;
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
  color: #6c757d;
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
.heatmap-cell.level-3 { background: #4e8be6; }
.heatmap-cell.level-4 { background: #2f5f9e; }
.heatmap-cell.is-future { visibility: hidden; }

.heatmap-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  margin-top: 0.5rem;
  font-size: 0.7rem;
  color: #6c757d;
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
  padding: 1.5rem;
  margin-bottom: 1.25rem;
  background: #fffafa;
  border: 1px solid #f1aeb5;
  border-radius: 20px;
}

.danger-text {
  font-size: 0.9rem;
  color: #495057;
}

.delete-dialog {
  width: calc(100% - 2rem);
  max-width: 440px;
  padding: 1.5rem;
  border: none;
  border-radius: 16px;
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
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .profile-card,
  .danger-card {
    padding: 1.25rem;
  }

  .card-grid {
    grid-template-columns: 1fr;
  }

  .identity {
    gap: 1rem;
  }

  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
