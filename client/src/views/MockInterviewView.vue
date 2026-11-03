<script setup>
import { ref, computed, onMounted } from 'vue'
import CommunityQuestionsModal from '../components/CommunityQuestionsModal.vue'

const isLoggedOut = ref(false)
const userName = ref('Student')
const questions = ref([])
const communityQuestions = ref([])

const activeId = ref(null)
const showModal = ref(false)
const showSaveMessage = ref(false)
const isAdding = ref(false)

// 1. Load user's saved journal questions from GET /api/interview
async function loadJournal() {
  try {
    const res = await fetch('/api/interview')

    if (res.status === 401) {
      isLoggedOut.value = true
      return
    }

    const data = await res.json()
    if (res.ok && data.questions) {
      isLoggedOut.value = false
      userName.value = data.userName || 'Student'
      questions.value = data.questions
      if (questions.value.length > 0) {
        activeId.value = questions.value[0].id
      }
    }
  } catch (error) {
    console.error('Error loading journal:', error)
  }
}

// 2. Load community questions directly from GET /api/intel
async function loadCommunityQuestions() {
  try {
    const res = await fetch('/api/intel')
    const data = await res.json()
    if (!res.ok || !data.posts) return

    const extracted = []
    for (const post of data.posts) {
      if (post.type === 'Interview questions' && Array.isArray(post.questions)) {
        for (let i = 0; i < post.questions.length; i++) {
          extracted.push({
            id: `${post.id}-q${i}`,
            company: post.company,
            role: post.role,
            category: 'Community Question',
            text: post.questions[i],
            upvotes: post.upvotes,
            tip: 'Use the STAR method: Situation, Task, Action, and Result.'
          })
        }
      }
    }
    communityQuestions.value = extracted
  } catch (error) {
    console.error('Error loading community questions:', error)
  }
}

onMounted(() => {
  loadJournal()
  loadCommunityQuestions()
})

// Format display number safely (01, 02...) using array index
function formatNum(num) {
  return num < 10 ? '0' + num : String(num)
}

// Check if current text matches what was saved in MongoDB
function isQuestionSaved(q) {
  if (!q) return false
  return q.savedResponse !== '' && q.response.trim() === q.savedResponse
}

const activeQuestion = computed(() => {
  return questions.value.find((q) => q.id === activeId.value) || questions.value[0]
})

const activeNumber = computed(() => {
  const index = questions.value.findIndex((q) => q.id === activeQuestion.value?.id)
  return formatNum(index + 1)
})

const wordCount = computed(() => {
  if (!activeQuestion.value) return 0
  const text = activeQuestion.value.response.trim()
  if (text === '') return 0
  return text.split(/\s+/).length
})

const savedCount = computed(() => {
  return questions.value.filter((q) => q.savedResponse !== '').length
})

// Count how many community questions haven't been added yet
const availableCount = computed(() => {
  let count = 0
  for (const cq of communityQuestions.value) {
    const alreadyExists = questions.value.some(
      (q) => q.sourceId === cq.id || q.text.toLowerCase() === cq.text.toLowerCase()
    )
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

// Clear current reflection in MongoDB
async function clearResponse() {
  if (!activeQuestion.value) return
  if (!confirm('Clear your current reflection?')) return

  try {
    const res = await fetch('/api/interview/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: activeQuestion.value.id,
        response: ''
      })
    })

    if (res.status === 401) {
      isLoggedOut.value = true
      return
    }

    if (res.ok) {
      activeQuestion.value.response = ''
      activeQuestion.value.savedResponse = ''
      activeQuestion.value.savedAt = ''
      showSaveMessage.value = false
    }
  } catch (error) {
    console.error('Error clearing response:', error)
  }
}

// Save current reflection to MongoDB
async function saveResponse() {
  if (!activeQuestion.value) return
  const cleanText = activeQuestion.value.response.trim()
  if (cleanText === '') return

  try {
    const res = await fetch('/api/interview/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: activeQuestion.value.id,
        response: cleanText
      })
    })

    if (res.status === 401) {
      isLoggedOut.value = true
      return
    }

    const data = await res.json()

    if (res.ok) {
      activeQuestion.value.response = cleanText
      activeQuestion.value.savedResponse = data.savedResponse
      activeQuestion.value.savedAt = data.savedAt

      showSaveMessage.value = true
      setTimeout(() => {
        showSaveMessage.value = false
      }, 3000)
    }
  } catch (error) {
    console.error('Error saving response:', error)
  }
}

// Add a question from the modal into MongoDB
async function addQuestionToJournal(cq) {
  if (isAdding.value) return
  isAdding.value = true

  try {
    const res = await fetch('/api/interview/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceId: cq.id,
        category: cq.category,
        company: cq.company,
        text: cq.text,
        tip: cq.tip
      })
    })

    if (res.status === 401) {
      isLoggedOut.value = true
      showModal.value = false
      return
    }

    const data = await res.json()

    if (res.ok && data.question) {
      questions.value.push(data.question)
      activeId.value = data.question.id
    }
  } catch (error) {
    console.error('Error adding question:', error)
  } finally {
    isAdding.value = false
  }
}

// Remove a question from the user's journal in MongoDB
async function deleteQuestion(questionId) {
  if (!confirm('Remove this question from your journal?')) return

  try {
    const res = await fetch(`/api/interview/questions/${questionId}`, {
      method: 'DELETE'
    })

    if (res.status === 401) {
      isLoggedOut.value = true
      return
    }

    if (res.ok) {
      questions.value = questions.value.filter((q) => q.id !== questionId)
      if (questions.value.length > 0) {
        activeId.value = questions.value[0].id
      } else {
        activeId.value = null
      }
      showSaveMessage.value = false
    }
  } catch (error) {
    console.error('Error deleting question:', error)
  }
}
</script>

<template>
  <section class="text-start">
    <!-- Shown if user is not logged in -->
    <div v-if="isLoggedOut" class="card-inturn p-5 text-center my-4 mx-auto" style="max-width: 520px;">
      <i class="bi bi-lock fs-1 text-primary mb-2"></i>
      <h2 class="h4 fw-semibold mb-2">Log in to access your Interview Journal</h2>
      <p class="text-secondary small mb-4">
        Sign in to practice common interview questions, save your STAR reflections, and track your preparation progress.
      </p>
      <div>
        <RouterLink to="/login" class="btn-primary-inturn">
          Go to Login
        </RouterLink>
      </div>
    </div>

    <!-- Shown when logged in -->
    <div v-else>
      <!-- Top Header -->
      <header class="page-header">
        <div>
          <h1 class="header-title">Interview Journal</h1>
          <p class="header-subtitle">
            Hi {{ userName }} - Let's turn your experiences into ready-made interview stories
          </p>
        </div>
        <div class="small fw-semibold text-secondary">
          <i class="bi bi-journal-check me-1 text-primary"></i>
          {{ savedCount }} / {{ questions.length }} Saved to Journal
        </div>
      </header>

      <div class="row g-4">
        <!-- Left Column: Questions List -->
        <div class="col-12 col-lg-5">
          <section class="card-inturn p-0 pt-4 overflow-hidden">
            <div class="px-3 px-md-4 pb-3">
              <h2 class="section-title mb-1">Practice Questions</h2>
              <div class="text-secondary small">
                {{ questions.length }} {{ questions.length === 1 ? 'Question' : 'Questions' }} in your journal
              </div>
            </div>

            <!-- Empty State if no questions in list -->
            <div v-if="questions.length === 0" class="px-3 px-md-4 py-4 text-center border-top border-secondary-subtle">
              <p class="text-secondary small mb-0">
                No practice questions in your journal yet. Browse community questions below to get started!
              </p>
            </div>

            <!-- Question Items -->
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
                    <span v-if="q.company" class="tag-inturn">
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
              class="browse-intel-bar w-100 d-flex justify-content-between align-items-center gap-2 px-3 px-md-4 py-3 border-0 border-top border-secondary-subtle text-start"
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
            class="card-inturn p-4 h-100 d-flex flex-column align-items-center justify-content-center text-center"
          >
            <i class="bi bi-journal-plus fs-1 text-secondary mb-2"></i>
            <h2 class="section-title mb-1">No question selected</h2>
            <p class="text-secondary small mb-3">
              Add questions from the Interview Intel community to start practicing your responses.
            </p>
            <button class="btn-primary-inturn" @click="showModal = true">
              <i class="bi bi-people me-2"></i>Browse Community Questions
            </button>
          </section>

          <!-- Active Question Editor -->
          <section
            v-else
            class="card-inturn h-100 d-flex flex-column"
          >
            <div class="d-flex justify-content-between align-items-center small mb-2">
              <span class="text-secondary fw-semibold">
                Question {{ activeNumber }}
              </span>
              <div class="d-flex align-items-center gap-3">
                <span class="fw-semibold text-primary">{{ activeQuestion.category }}</span>
                <button
                  type="button"
                  class="btn-link-inturn text-danger"
                  title="Remove question from journal"
                  @click="deleteQuestion(activeQuestion.id)"
                >
                  <i class="bi bi-trash me-1"></i>Remove
                </button>
              </div>
            </div>

            <h2 class="h5 fw-bold mb-3 text-break">{{ activeQuestion.text }}</h2>

            <!-- Helpful Tips Box -->
            <div class="callout-inturn mb-3">
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
              class="input-inturn flex-grow-1 reflection-box"
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
                  class="btn-link-inturn"
                  :disabled="!activeQuestion.response.trim()"
                  @click="clearResponse"
                >
                  Clear
                </button>
                <button
                  class="btn-primary-inturn"
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
    </div>
  </section>
</template>

<style scoped>
.q-item-active {
  background-color: var(--inturn-primary-soft) !important;
}
.browse-intel-bar {
  font: inherit;
  background-color: var(--inturn-surface-muted);
}
.browse-intel-bar:hover {
  background-color: var(--inturn-primary-soft);
}
.reflection-box {
  resize: none;
  min-height: 240px;
}
</style>
