<script setup>
import { ref, reactive, computed } from 'vue'

const ago = (mins) => new Date(Date.now() - mins * 60000).toISOString()

// Static sample data (Matches MongoDB document structure)
const posts = ref([
  {
    id: 'm1',
    type: 'Experience',
    company: 'GovTech',
    role: 'Full-Stack Engineering Intern',
    title: 'My GovTech technical interview experience',
    questions: [],
    experience: 'The interview was conversational and focused more on how I made engineering decisions than getting a perfect answer. I walked through one of my projects, then discussed API design, testing, and a production bug I had fixed.',
    upvotes: 42,
    upvoted: false,
    createdAt: ago(120)
  },
  {
    id: 'm2',
    type: 'Interview questions',
    company: 'Grab',
    role: 'Software Engineering Intern',
    title: 'Questions from my Grab engineering interview',
    experience: '',
    questions: [
      'Explain how you would design a food-order status tracker, including real-time updates and failure states',
      'Tell me about a disagreement in a team project and what you learned from it'
    ],
    upvotes: 31,
    upvoted: false,
    createdAt: ago(60 * 24)
  },
  {
    id: 'm3',
    type: 'Experience',
    company: 'Shopee',
    role: 'Product Management Intern',
    title: 'How my Shopee PM intern interviews went',
    questions: [],
    experience: 'Two rounds: a behavioural chat about a project I led, then a product case on improving seller onboarding. They cared most about how I structured my thinking and used data to back my choices.',
    upvotes: 27,
    upvoted: false,
    createdAt: ago(60 * 48)
  },
  {
    id: 'm4',
    type: 'Interview questions',
    company: 'DBS',
    role: 'Data Analyst Intern',
    title: 'SQL and case questions from DBS',
    experience: '',
    questions: [
      'Write a query using a window function to rank customers by monthly spend',
      'Weekly active users dropped 10% last week. How would you investigate?',
      'Explain the difference between an INNER JOIN and a LEFT JOIN with an example'
    ],
    upvotes: 19,
    upvoted: false,
    createdAt: ago(60 * 96)
  }
])

// ---- Filters
const filters = reactive({ type: 'All', company: 'All', role: 'All' })
const types = ['Experience', 'Interview questions']

const companies = computed(() => {
  const map = new Map()
  posts.value.forEach((p) => {
    const key = p.company.trim().toLowerCase()
    if (!map.has(key)) map.set(key, p.company.trim())
  })
  return [...map.values()].sort()
})

const roles = computed(() => {
  const map = new Map()
  posts.value.forEach((p) => {
    const key = p.role.trim().toLowerCase()
    if (!map.has(key)) map.set(key, p.role.trim())
  })
  return [...map.values()].sort()
})

const visible = computed(() =>
  posts.value.filter((p) =>
    (filters.type === 'All' || p.type === filters.type) &&
    (filters.company === 'All' || p.company.trim().toLowerCase() === filters.company.toLowerCase()) &&
    (filters.role === 'All' || p.role.trim().toLowerCase() === filters.role.toLowerCase())
  )
)

// ---- Upvote
function toggleUpvote(post) {
  post.upvoted = !post.upvoted
  post.upvotes += post.upvoted ? 1 : -1
  // TODO: Send POST /api/intel/:id/upvote to MongoDB backend later
}

// ---- Share form
const composing = ref(false)
const form = ref({
  type: 'Experience',
  company: '',
  role: '',
  title: '',
  body: ''
})

const canPublish = computed(() =>
  form.value.company.trim() &&
  form.value.role.trim() &&
  form.value.title.trim() &&
  form.value.body.trim()
)

function resetForm() {
  composing.value = false
  form.value = { type: 'Experience', company: '', role: '', title: '', body: '' }
}

function publish() {
  if (!canPublish.value) return

  const isExp = form.value.type === 'Experience'
  const lines = form.value.body
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)

  const newPost = {
    id: `local-${Date.now()}`,
    type: form.value.type,
    title: form.value.title.trim(),
    company: form.value.company.trim(),
    role: form.value.role.trim(),
    experience: isExp ? form.value.body.trim() : '',
    questions: isExp ? [] : lines,
    upvotes: 0,
    upvoted: false,
    createdAt: new Date().toISOString()
  }

  // TODO: POST newPost to MongoDB backend
  posts.value.unshift(newPost)

  filters.type = 'All'
  filters.company = 'All'
  filters.role = 'All'

  resetForm()
}

// ---- Display helpers
function timeAgo(iso) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 60000))
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}
</script>

<template>
  <div class="bg-body-tertiary min-vh-100 p-3 p-lg-4 text-start">
    <div class="container-xl px-0">
      <!-- Header -->
      <header class="card rounded-4 p-3 p-sm-4 mb-4 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3">
        <div>
          <div class="text-primary text-uppercase fw-bold" style="font-size: 0.7rem; letter-spacing: 0.06em;">
            Community knowledge
          </div>
          <h1 class="h3 fw-semibold mb-1">Interview Intel</h1>
          <p class="text-secondary small mb-0">Learn from real interview experiences shared by students.</p>
        </div>
        <button class="btn btn-inturn rounded-3 fw-semibold px-3 py-2" @click="composing = true">
          <i class="bi bi-plus-lg me-2"></i>Share your experience
        </button>
      </header>

      <!-- Share form -->
      <section v-if="composing" class="card rounded-4 p-3 p-sm-4 mb-3">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div class="text-primary text-uppercase fw-bold" style="font-size: 0.7rem; letter-spacing: 0.06em;">
              Help the next candidate
            </div>
            <h2 class="h4 fw-semibold mt-1 mb-3">Share interview intel</h2>
          </div>
          <button class="btn btn-link btn-sm text-secondary text-decoration-none p-0" @click="resetForm">
            Cancel
          </button>
        </div>

        <div class="row g-3">
          <div class="col-12 col-md-4">
            <label class="form-label small fw-semibold mb-1">Post type</label>
            <select v-model="form.type" class="form-select bg-body-tertiary rounded-3">
              <option v-for="t in types" :key="t">{{ t }}</option>
            </select>
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label small fw-semibold mb-1">Company</label>
            <input v-model="form.company" class="form-control bg-body-tertiary rounded-3" placeholder="e.g. GovTech" maxlength="80" />
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label small fw-semibold mb-1">Role</label>
            <input v-model="form.role" class="form-control bg-body-tertiary rounded-3" placeholder="e.g. Engineering Intern" maxlength="80" />
          </div>
          <div class="col-12">
            <label class="form-label small fw-semibold mb-1">Title</label>
            <input v-model="form.title" class="form-control bg-body-tertiary rounded-3" placeholder="Give your post a clear title" maxlength="120" />
          </div>
          <div class="col-12">
            <label class="form-label small fw-semibold mb-1">
              {{ form.type === 'Experience' ? 'What would you like others to know?' : 'Which questions were you asked? (one per line)' }}
            </label>
            <textarea
              v-model="form.body"
              class="form-control bg-body-tertiary rounded-3"
              rows="5"
              maxlength="2000"
              :placeholder="form.type === 'Experience' ? 'Share the process, questions, and anything that helped you prepare…' : 'How would you design a rate limiter?\nTell me about a time you disagreed with a teammate'"
            ></textarea>
          </div>
        </div>

        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4">
          <span class="small text-secondary">Keep personal or confidential information out of your post.</span>
          <button class="btn btn-inturn rounded-3 fw-semibold px-4 py-2" :disabled="!canPublish" @click="publish">
            Publish post
          </button>
        </div>
      </section>

      <!-- Filters -->
      <section class="card rounded-4 p-3 p-sm-4 mb-3">
        <div class="row g-3 align-items-center">
          <div class="col-12 col-md-4">
            <div class="fw-semibold">Explore the community</div>
            <div class="text-secondary small">{{ visible.length }} post{{ visible.length === 1 ? '' : 's' }}</div>
          </div>
          <div class="col-12 col-md-8">
            <div class="row g-3">
              <div class="col-12 col-sm-4">
                <label class="form-label small fw-semibold mb-1">Post type</label>
                <select v-model="filters.type" class="form-select bg-body-tertiary rounded-3">
                  <option>All</option>
                  <option v-for="t in types" :key="t">{{ t }}</option>
                </select>
              </div>
              <div class="col-12 col-sm-4">
                <label class="form-label small fw-semibold mb-1">Company</label>
                <select v-model="filters.company" class="form-select bg-body-tertiary rounded-3">
                  <option>All</option>
                  <option v-for="c in companies" :key="c">{{ c }}</option>
                </select>
              </div>
              <div class="col-12 col-sm-4">
                <label class="form-label small fw-semibold mb-1">Role</label>
                <select v-model="filters.role" class="form-select bg-body-tertiary rounded-3">
                  <option>All</option>
                  <option v-for="r in roles" :key="r">{{ r }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Empty State -->
      <p v-if="!visible.length" class="text-secondary text-center py-4">
        No posts match these filters yet.
      </p>

      <!-- Feed Posts -->
      <article
        v-for="p in visible"
        :key="p._id || p.id"
        class="card rounded-4 p-3 p-sm-4 mb-3 d-flex flex-column flex-sm-row gap-3"
      >
        <!-- Upvote Button (Row on mobile, Column on sm+) -->
        <button
          class="btn upvote-btn rounded-3 d-flex flex-row flex-sm-column align-items-center justify-content-center gap-2 gap-sm-0 align-self-start px-3 py-2"
          :class="p.upvoted ? 'upvote-active' : 'btn-outline-secondary border-secondary-subtle text-dark'"
          :aria-pressed="!!p.upvoted"
          :aria-label="`Upvote (${p.upvotes})`"
          @click="toggleUpvote(p)"
        >
          <i class="bi bi-arrow-up fs-5"></i>
          <strong>{{ p.upvotes }}</strong>
          <span style="font-size: 0.65rem;">Upvote</span>
        </button>

        <div class="flex-grow-1 min-w-0">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div class="d-flex align-items-center gap-2">
              <span
                class="rounded-circle bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center"
                style="width: 36px; height: 36px;"
              >
                <i class="bi bi-person-fill"></i>
              </span>
              <div>
                <div class="fw-semibold small">Anonymous student</div>
                <div class="text-secondary" style="font-size: 0.72rem;">{{ timeAgo(p.createdAt) }}</div>
              </div>
            </div>
            <span
              class="badge rounded-pill px-3 py-2"
              :class="p.type === 'Experience' ? 'bg-success-subtle text-success' : 'bg-primary-subtle text-primary'"
            >
              {{ p.type }}
            </span>
          </div>

          <div class="d-flex flex-wrap gap-2 my-2">
            <span class="badge bg-body-secondary text-dark fw-normal px-2 py-1">{{ p.company }}</span>
            <span class="badge bg-body-secondary text-dark fw-normal px-2 py-1">{{ p.role }}</span>
          </div>

          <h3 class="h5 fw-semibold mb-2">{{ p.title }}</h3>
          <ul v-if="p.questions?.length" class="text-secondary small ps-3 mb-0">
            <li v-for="(q, i) in p.questions" :key="i">{{ q }}</li>
          </ul>
          <p v-else class="text-secondary small mb-0">{{ p.experience }}</p>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.btn-inturn {
  background-color: #4a86e8;
  color: #fff;
  border: 0;
  box-shadow: 0 4px 12px rgba(74, 134, 232, 0.25);
}
.btn-inturn:hover {
  background-color: #3a74d4;
  color: #fff;
}
.btn-inturn:disabled {
  background-color: #9db9ea;
  color: #fff;
  box-shadow: none;
}

.upvote-btn {
  min-width: 72px;
}
.upvote-active {
  background-color: #e1edfd;
  border: 1px solid #4a86e8;
  color: #4a86e8;
}
</style>