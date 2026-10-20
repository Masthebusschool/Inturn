<script setup>
import { ref, reactive, computed, nextTick } from 'vue'
// import CommunityQuestionModal from './CommunityQuestionModal.vue'

const nav = [
  { label: 'Profile', icon: 'bi-person-fill' },
  { label: 'Applications Board', icon: 'bi-clipboard-check' },
  { label: 'Job Discovery', icon: 'bi-globe' },
  { label: 'Interview Intel', icon: 'bi-chat-square-text-fill' },
  { label: 'Skill Gap Analysis', icon: 'bi-card-checklist' },
]

// ---- Practice questions (the user's journal)
const questions = ref([
  { id: 1, category: 'Technical', text: 'Explain the concept of technical design and how you implement it',
    tip: 'Outline how you plan before coding, and give one real example.' },
  { id: 2, category: 'Collaboration', text: 'Tell me about a disagreement with a teammate over a technical approach',
    tip: 'Focus on how you listened, compromised and what the outcome was.' },
  { id: 3, category: 'Problem Solving', text: 'Describe a difficult bug you encountered and how you diagnosed and fixed it',
    tip: 'Walk through your debugging process, the tools you used, and what you learned from it' },
])

const activeId = ref(3)
const responses = reactive({ 1: '', 2: '', 3: '' })

const active = computed(() => questions.value.find((q) => q.id === activeId.value))
const wordCount = computed(() => ((responses[activeId.value] || '').trim().match(/\S+/g) || []).length)

const responsePanel = ref(null)
const select = (id) => {
  activeId.value = id
  // On stacked layouts (< 992px) the reflection panel is below the list, so bring it into view
  if (window.innerWidth < 992) {
    nextTick(() => responsePanel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
}
const clear = () => (responses[activeId.value] = '')
const save = () => {
  // TODO: replace with your API call
  console.log('Saved', activeId.value, responses[activeId.value])
}

// ---- Community question bank (modal fetches its own data)
const showBank = ref(false)
const added = reactive({}) // { [communityQuestionId]: true }

const addToJournal = (c) => {
  if (added[c.id]) return
  const id = Math.max(...questions.value.map((q) => q.id)) + 1
  questions.value.push({ id, category: c.category, text: c.text, tip: 'Use a specific example from your own experience.' })
  responses[id] = ''
  added[c.id] = true
}
</script>

<template>
  <div class="page d-flex flex-column flex-lg-row">
    <!-- Sidebar (left column >= 992px, sticky top bar below) -->
    <aside class="sidebar">
      <div class="brand-row d-flex align-items-center gap-2 p-3 pb-lg-4 pb-2">
        <small class="fw-bold">Logo</small>
        <span class="brand">Inturn</span>
      </div>
      <nav class="nav flex-nowrap flex-lg-column">
        <a v-for="item in nav" :key="item.label" href="#" class="nav-link"
           :class="{ active: item.label === 'Interview Intel' }">
          <i class="bi" :class="item.icon"></i>{{ item.label }}
        </a>
      </nav>
    </aside>

    <!-- Main -->
    <main class="flex-grow-1 p-3 p-lg-4">
      <div class="header-card mb-4">
        <h1 class="h5 mb-1">Gerald’s Interview Journal</h1>
        <p class="small mb-0">Hi Gerald - Let’s turn your experiences into ready-made interview stories</p>
      </div>

      <div class="row g-4 px-lg-4">
        <!-- Questions list -->
        <div class="col-12 col-lg-5">
          <section class="panel pt-4 pb-2 h-100">
            <div class="px-3 px-md-4 pb-3 d-flex justify-content-between align-items-start">
              <div>
                <div class="text-muted fw-semibold" style="font-size:.65rem">Govtech | Fullstack Intern</div>
                <h2 class="h6 fw-bold mt-2 mb-1">Practice Questions</h2>
                <div class="text-muted" style="font-size:.7rem">{{ questions.length }} Questions tailored to this role</div>
              </div>
              <span class="border rounded bg-white px-2 py-1"><i class="bi bi-briefcase"></i></span>
            </div>

            <button v-for="q in questions" :key="q.id" class="q-item"
                    :class="{ active: q.id === activeId }" @click="select(q.id)">
              <span class="q-num">{{ String(q.id).padStart(2, '0') }}</span>
              <span class="flex-grow-1">
                <span class="q-cat d-block">{{ q.category }}</span>
                <span class="q-text d-block">{{ q.text }}</span>
              </span>
              <i class="bi bi-chevron-right text-secondary"></i>
            </button>

            <button class="q-item justify-content-between py-4" @click="showBank = true">
              <span class="fw-semibold small">Browse Community Questions</span>
              <i class="bi bi-arrow-right fs-5 text-secondary"></i>
            </button>
          </section>
        </div>

        <!-- Response editor -->
        <div class="col-12 col-lg-7">
          <section ref="responsePanel" class="panel response-panel p-3 p-md-4 h-100 d-flex flex-column">
            <div class="d-flex justify-content-between small mb-2">
              <span class="text-muted fw-semibold">Question {{ String(active.id).padStart(2, '0') }}</span>
              <span class="fw-semibold cat-label">{{ active.category }}</span>
            </div>
            <h2 class="h5 fw-bold mb-3">{{ active.text }}</h2>

            <div class="tips mb-3">
              <div class="fw-semibold small">Helpful Tips</div>
              <div style="font-size:.75rem">{{ active.tip }}</div>
            </div>

            <div class="d-flex justify-content-between small mb-2">
              <span class="fw-semibold">Your Reflection</span>
              <span class="text-muted">{{ wordCount }} words</span>
            </div>
            <textarea v-model="responses[active.id]" class="form-control reflection flex-grow-1"
                      placeholder="Start writing your response here..."></textarea>

            <div class="d-flex justify-content-end align-items-center gap-3 mt-4">
              <button class="btn btn-link text-secondary text-decoration-none small p-0" @click="clear">Clear</button>
              <button class="btn btn-inturn" @click="save">Save Response</button>
            </div>
          </section>
        </div>
      </div>
    </main>

    <CommunityQuestionModal
      :open="showBank"
      :added="added"
      @close="showBank = false"
      @add="addToJournal"
    />
  </div>
</template>

<style scoped>
.page { width: 100%; min-height: 100vh; text-align: left; }

/* Sidebar */
.sidebar { width: 220px; align-self: stretch; min-height: 100vh; background: var(--inturn-blue); color: #fff; flex-shrink: 0; }
.sidebar .brand { font-size: 1.5rem; font-weight: 700; }
.sidebar .nav-link { color: #fff; font-size: .8rem; padding: .7rem 1rem; display: flex; align-items: center; gap: .75rem; border-radius: 0; }
.sidebar .nav-link.active { background: rgba(0,0,0,.2); font-weight: 600; }
.sidebar .nav-link:hover { background: rgba(0,0,0,.12); }

/* Header card */
.header-card { border: 1px solid #ddd; border-radius: 8px; padding: 1rem 1.25rem; }

/* Panels */
.panel { background: var(--panel); border-radius: 28px; }
.q-item { border: 0; border-top: 1px solid #444; background: transparent; width: 100%; text-align: left;
          padding: 1.1rem 1.5rem; display: flex; align-items: center; gap: 1rem; cursor: pointer; color: var(--ink); }
.q-item:hover { background: #ebebeb; }
.q-item.active { background: var(--inturn-blue-light); }
.q-num { color: #555; width: 1.5rem; flex-shrink: 0; }
.q-cat, .cat-label { color: var(--inturn-blue); }
.q-cat { font-size: .7rem; font-weight: 600; }
.q-text { font-size: .85rem; line-height: 1.3; }

.tips { background: var(--inturn-blue); color: #fff; border-radius: 10px; padding: .75rem 1rem; }
.reflection { background: #fff; border: 0; border-radius: 22px; resize: none; min-height: 260px; padding: 1.25rem; }
.reflection:focus { box-shadow: 0 0 0 .2rem rgba(74,134,232,.3); }
.response-panel { scroll-margin-top: 110px; } /* keeps it clear of the sticky top bar */

/* Below 768px: tighter spacing for phones */
@media (max-width: 767.98px) {
  .panel { border-radius: 20px; }
  .q-item { padding: .9rem 1rem; }
  .header-card { padding: .85rem 1rem; }
  .reflection { min-height: 200px; padding: 1rem; border-radius: 16px; }
  .sidebar .brand { font-size: 1.25rem; }
}

/* Below 992px: sidebar becomes a sticky top bar, content stacks (questions, then reflection) */
@media (max-width: 991.98px) {
  .sidebar { width: 100%; min-height: auto; position: sticky; top: 0; z-index: 100; }
  .sidebar .nav { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .sidebar .nav::-webkit-scrollbar { display: none; }
  .sidebar .nav-link { white-space: nowrap; border-bottom: 3px solid transparent; }
  .sidebar .nav-link.active { background: transparent; border-bottom-color: #fff; }
}
</style>
