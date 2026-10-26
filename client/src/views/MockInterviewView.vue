<script setup>
import { ref, computed } from 'vue'
import CommunityQuestionsModal from '../components/CommunityQuestionsModal.vue'

// 1. Practice questions list
// Uses savedResponse to compare against current response so editing immediately shows "Unsaved changes"
const questions = ref([
  {
    id: 1,
    sourceId: 'default-1',
    category: 'Technical',
    text: 'Explain a full-stack feature you built and how you implemented it.',
    tip: 'Outline how you plan before coding, and give one real example.',
    response: '',
    savedResponse: '',
    savedAt: ''
  },
  {
    id: 2,
    sourceId: 'default-2',
    category: 'Collaboration',
    text: 'Tell me about a disagreement with a teammate over a technical approach.',
    tip: 'Focus on how you listened, compromised and what the outcome was.',
    response: '',
    savedResponse: '',
    savedAt: ''
  },
  {
    id: 3,
    sourceId: 'default-3',
    category: 'Problem Solving',
    text: 'Describe a difficult bug you encountered and how you diagnosed and fixed it.',
    tip: 'Walk through your debugging process, the tools you used, and what you learned from it.',
    response: '',
    savedResponse: '',
    savedAt: ''
  }
])

// 2. Community questions shown in the pop-up modal (Consistent Title Case categories)
const communityQuestions = ref([
  {
    id: 'c1',
    company: 'Grab',
    role: 'Software Engineering Intern',
    category: 'System Design',
    text: 'How would you design a food-order status tracker with real-time updates?',
    upvotes: 31,
    tip: 'Discuss how the frontend gets live updates and how you handle failed orders.'
  },
  {
    id: 'c2',
    company: 'Grab',
    role: 'Software Engineering Intern',
    category: 'Collaboration',
    text: 'Tell me about a disagreement in a team project and what you learned from it.',
    upvotes: 31,
    tip: 'Use the STAR method: Situation, Task, Action, and Result.'
  },
  {
    id: 'c3',
    company: 'ByteDance',
    role: 'Backend Engineering Intern',
    category: 'Technical',
    text: 'How would you diagnose an API endpoint that suddenly became much slower?',
    upvotes: 19,
    tip: 'Talk about checking database queries, server logs, and recent code changes.'
  },
  {
    id: 'c4',
    company: 'ByteDance',
    role: 'Backend Engineering Intern',
    category: 'Technical',
    text: 'When would you use caching, and how would you keep cached data consistent?',
    upvotes: 19,
    tip: 'Explain how caching speeds up repeated reads and when to clear old cache data.'
  }
])

const activeId = ref(1)
const showModal = ref(false)
const showSaveMessage = ref(false)

// Format display number safely (01, 02...) using array index so string IDs never break it
function formatNum(num) {
  return num < 10 ? '0' + num : String(num)
}

// A question is considered saved ONLY if savedResponse is not empty AND matches current text
function isQuestionSaved(q) {
  if (!q) return false
  return q.savedResponse !== '' && q.response.trim() === q.savedResponse
}

// Find the currently selected question object
const activeQuestion = computed(() => {
  return questions.value.find((q) => q.id === activeId.value) || questions.value[0]
})

// Find the 1-based display number of the active question
const activeNumber = computed(() => {
  const index = questions.value.findIndex((q) => q.id === activeQuestion.value?.id)
  return formatNum(index + 1)
})

// Count words in the current reflection
const wordCount = computed(() => {
  if (!activeQuestion.value) return 0
  const text = activeQuestion.value.response.trim()
  if (text === '') return 0
  return text.split(/\s+/).length
})

// Count how many questions have a saved response
const savedCount = computed(() => {
  return questions.value.filter((q) => q.savedResponse !== '').length
})

// Count how many community questions haven't been added yet (checked by sourceId)
const availableCount = computed(() => {
  let count = 0
  for (const cq of communityQuestions.value) {
    const alreadyExists = questions.value.some((q) => q.sourceId === cq.id)
    if (!alreadyExists) {
      count++
    }
  }
  return count
})

function selectQuestion(id) {
  activeId.value = id
  showSaveMessage.value = false
}

function clearResponse() {
  if (!activeQuestion.value) return
  if (confirm('Clear your current reflection?')) {
    activeQuestion.value.response = ''
    activeQuestion.value.savedResponse = ''
    activeQuestion.value.savedAt = ''
    showSaveMessage.value = false
  }
}

function saveResponse() {
  if (!activeQuestion.value) return
  const cleanText = activeQuestion.value.response.trim()
  if (cleanText === '') return

  activeQuestion.value.response = cleanText
  activeQuestion.value.savedResponse = cleanText

  const now = new Date()
  activeQuestion.value.savedAt = now.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  showSaveMessage.value = true
  setTimeout(() => {
    showSaveMessage.value = false
  }, 3000)
}

// Add a question from the modal with a safe unique ID and sourceId
function addQuestionToJournal(cq) {
  let maxId = 0
  for (const q of questions.value) {
    if (typeof q.id === 'number' && q.id > maxId) {
      maxId = q.id
    }
  }
  const newId = maxId + 1

  questions.value.push({
    id: newId,
    sourceId: cq.id,
    category: cq.category,
    company: cq.company,
    text: cq.text,
    tip: cq.tip,
    response: '',
    savedResponse: '',
    savedAt: ''
  })

  activeId.value = newId
}
</script>

<template>
  <main class="p-3 p-lg-4 text-start">
    <!-- Top Header -->
    <div class="card rounded-3 p-3 mb-4 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
      <div>
        <h1 class="h5 mb-1">Gerald's Interview Journal</h1>
        <p class="small mb-0 text-secondary">
          Hi Gerald - Let's turn your experiences into ready-made interview stories
        </p>
      </div>
      <div class="small fw-semibold text-secondary">
        <i class="bi bi-journal-check me-1 text-primary"></i>
        {{ savedCount }} / {{ questions.length }} Saved to Journal
      </div>
    </div>

    <div class="row g-4 px-lg-4">
      <!-- Left Column: Questions List -->
      <div class="col-12 col-lg-5">
        <section class="card border-0 bg-body-secondary rounded-4 pt-4 overflow-hidden">
          <div class="px-3 px-md-4 pb-3">
            <div class="text-secondary fw-semibold small">
              GovTech | Fullstack Intern
            </div>
            <h2 class="h6 fw-bold mt-2 mb-1">Practice Questions</h2>
            <div class="text-secondary small">
              {{ questions.length }} {{ questions.length === 1 ? 'Question' : 'Questions' }} tailored to this role
            </div>
          </div>

          <!-- Empty State if no questions in list -->
          <div v-if="questions.length === 0" class="px-3 px-md-4 py-4 text-center border-top border-secondary-subtle">
            <p class="text-secondary small mb-0">
              No practice questions in your journal yet. Browse community questions below to get started!
            </p>
          </div>

          <!-- Question Items (numbered by index + 1) -->
          <div v-else class="list-group list-group-flush">
            <button
              v-for="(q, index) in questions"
              :key="q.id"
              type="button"
              class="list-group-item list-group-item-action d-flex align-items-center gap-3 px-3 px-md-4 py-3 border-top border-secondary-subtle"
              :class="q.id === activeId ? 'q-item-active' : 'bg-transparent'"
              @click="selectQuestion(q.id)"
            >
              <span class="text-secondary">
                {{ formatNum(index + 1) }}
              </span>

              <div class="flex-grow-1 min-w-0 text-break">
                <div class="d-flex flex-wrap align-items-center gap-2">
                  <span class="text-primary fw-semibold small">{{ q.category }}</span>
                  <span v-if="q.company" class="badge rounded-pill bg-primary-subtle text-primary">
                    {{ q.company }}
                  </span>
                  <span v-if="isQuestionSaved(q)" class="badge rounded-pill bg-success-subtle text-success">
                    <i class="bi bi-check-circle-fill me-1"></i>Saved
                  </span>
                  <span v-else-if="q.savedResponse !== ''" class="badge rounded-pill bg-warning-subtle text-warning-emphasis">
                    Edited
                  </span>
                </div>
                <div class="small text-dark mt-1">{{ q.text }}</div>
              </div>

              <i class="bi bi-chevron-right text-secondary"></i>
            </button>
          </div>

          <!-- Bottom Button to Open Modal -->
          <button
            type="button"
            class="btn browse-intel-bar w-100 d-flex justify-content-between align-items-center gap-2 px-3 px-md-4 py-3 border-top border-secondary-subtle rounded-0 text-start"
            @click="showModal = true"
          >
            <span class="d-flex align-items-center gap-2 small fw-semibold text-dark">
              <i class="bi bi-people text-secondary"></i>
              <span>Browse questions from Interview Intel</span>
            </span>
            <span class="text-secondary small text-nowrap flex-shrink-0">
              {{ availableCount }} available
            </span>
          </button>
        </section>
      </div>

      <!-- Right Column: Response Editor -->
      <div class="col-12 col-lg-7">
        <!-- Empty State if no question is selected -->
        <section
          v-if="!activeQuestion"
          class="card border-0 bg-body-secondary rounded-4 p-4 h-100 d-flex flex-column align-items-center justify-content-center text-center"
        >
          <i class="bi bi-journal-plus fs-1 text-secondary mb-2"></i>
          <h2 class="h5 fw-bold mb-1">No question selected</h2>
          <p class="text-secondary small mb-3">
            Add questions from the Interview Intel community to start practicing your responses.
          </p>
          <button class="btn btn-inturn rounded-pill px-4 py-2 small fw-semibold" @click="showModal = true">
            <i class="bi bi-people me-2"></i>Browse Community Questions
          </button>
        </section>

        <!-- Active Question Editor -->
        <section
          v-else
          class="card border-0 bg-body-secondary rounded-4 p-3 p-md-4 h-100 d-flex flex-column"
        >
          <div class="d-flex justify-content-between small mb-2">
            <span class="text-secondary fw-semibold">
              Question {{ activeNumber }}
            </span>
            <span class="fw-semibold text-primary">{{ activeQuestion.category }}</span>
          </div>

          <h2 class="h5 fw-bold mb-3 text-break">{{ activeQuestion.text }}</h2>

          <!-- Helpful Tips Box -->
          <div class="inturn-bg text-white rounded-3 p-3 mb-3">
            <div class="fw-semibold small">Helpful Tips</div>
            <div class="small">{{ activeQuestion.tip }}</div>
          </div>

          <div class="d-flex justify-content-between align-items-center small mb-2">
            <div>
              <label for="reflection-input" class="fw-semibold me-2 mb-0">Your Reflection</label>
              <span v-if="isQuestionSaved(activeQuestion)" class="text-secondary">
                (Saved {{ activeQuestion.savedAt }})
              </span>
              <span v-else-if="activeQuestion.response.trim() !== ''" class="text-warning-emphasis">
                &bull; Unsaved changes
              </span>
            </div>
            <span class="text-secondary">{{ wordCount }} {{ wordCount === 1 ? 'word' : 'words' }}</span>
          </div>

          <textarea
            id="reflection-input"
            v-model="activeQuestion.response"
            maxlength="4000"
            class="form-control border-0 rounded-4 p-3 flex-grow-1 reflection-box"
            placeholder="Start writing your response here..."
          ></textarea>

          <!-- Save / Clear Buttons -->
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-4">
            <div>
              <span v-if="showSaveMessage" class="small fw-semibold text-success">
                <i class="bi bi-check-circle-fill me-1"></i>Saved to your Interview Journal!
              </span>
            </div>

            <div class="d-flex align-items-center gap-3 ms-auto">
              <button
                class="btn btn-link text-secondary text-decoration-none small p-0"
                :disabled="!activeQuestion.response.trim()"
                @click="clearResponse"
              >
                Clear
              </button>
              <button
                class="btn btn-inturn rounded-pill px-3 py-2 small fw-semibold"
                :disabled="!activeQuestion.response.trim() || isQuestionSaved(activeQuestion)"
                @click="saveResponse"
              >
                {{ isQuestionSaved(activeQuestion) ? 'Saved' : 'Save Response' }}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Community Questions Modal Component -->
    <CommunityQuestionsModal
      :show="showModal"
      :community-questions="communityQuestions"
      :existing-questions="questions"
      @close="showModal = false"
      @add-question="addQuestionToJournal"
    />
  </main>
</template>

<style scoped>
.inturn-bg,
.btn-inturn {
  background-color: #4a86e8;
  color: #fff;
  border: 0;
}
.btn-inturn:hover {
  background-color: #3a74d4;
  color: #fff;
}
.btn-inturn:disabled {
  background-color: #9db9ea;
  color: #fff;
}
.q-item-active {
  background-color: #e1edfd !important;
}
.browse-intel-bar {
  background-color: #eaedf2;
}
.browse-intel-bar:hover {
  background-color: #dfe4ec;
}
.reflection-box {
  resize: none;
  min-height: 240px;
}
</style>