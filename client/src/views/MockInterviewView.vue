<script setup>
import { ref, computed, onMounted } from 'vue'
import CommunityQuestionsModal from '../components/CommunityQuestionsModal.vue'
import ConfirmModal from '../components/ConfirmModal.vue'

// Ensure all data is fetched before full page loads
const isLoading = ref(true)
const isLoggedOut = ref(false)
const userName = ref('Student')
const questions = ref([])
const communityQuestions = ref([])

const activeId = ref(null)
const showModal = ref(false)
const showSaveMessage = ref(false)
const isAdding = ref(false)

// Load user's saved journal questions from GET /api/interview
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

// Load community questions directly from GET /api/intel
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

onMounted(async () => {
  await Promise.all([loadJournal(), loadCommunityQuestions()])
  isLoading.value = false
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

// Controls for the two confirmation popups
const showClearConfirm = ref(false)
const questionToDelete = ref(null) // id of the question the user wants to remove

// Clicking "Clear" opens the popup
function clearResponse() {
  if (!activeQuestion.value) return
  showClearConfirm.value = true
}

// Clear current reflection in MongoDB (runs when the user confirms)
async function confirmClearResponse() {
  showClearConfirm.value = false // closes the popup
  if (!activeQuestion.value) return

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

// Clicking "Remove" opens the popup
function deleteQuestion(questionId) {
  questionToDelete.value = questionId
}

// Remove a question from the user's journal in MongoDB (runs when the user confirms)
async function confirmDeleteQuestion() {
  const questionId = questionToDelete.value
  questionToDelete.value = null // closes the popup
  if (!questionId) return

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
  <main class="p-3 p-lg-4 text-start">
    <!-- spinner in the page area -->
    <div v-if="isLoading" class="d-flex flex-column justify-content-center align-items-center text-secondary" style="min-height: 70vh">
      <div class="spinner-border text-primary mb-3" role="status"></div>
      <p class="mb-0">Loading your interview journal...</p>
    </div>

    <!-- Shown if user is not logged in -->
    <div v-else-if="isLoggedOut" class="card rounded-4 p-5 text-center my-4 mx-auto" style="max-width: 520px;">
      <i class="bi bi-lock fs-1 text-primary mb-2"></i>
      <h2 class="h4 fw-semibold mb-2">Log in to access your Interview Journal</h2>
      <p class="text-secondary small mb-4">
        Sign in to practice common interview questions, save your STAR reflections, and track your preparation progress.
      </p>
      <div>
        <RouterLink to="/login" class="btn btn-inturn rounded-pill px-4 py-2 fw-semibold">
          Go to Login
        </RouterLink>
      </div>
    </div>

    <!-- Shown when logged in -->
    <div v-else>
      <!-- Top Header -->
      <div class="card rounded-3 p-3 mb-4 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
        <div>
          <h1 class="h5 mb-1">{{ userName }}'s Interview Journal</h1>
          <p class="small mb-0 text-secondary">
            Hi {{ userName }} - Let's turn your experiences into ready-made interview stories
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
                Interview Preparation
              </div>
              <h2 class="h6 fw-bold mt-2 mb-1">Practice Questions</h2>
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
            <div class="d-flex justify-content-between align-items-center small mb-2">
              <span class="text-secondary fw-semibold">
                Question {{ activeNumber }}
              </span>
              <div class="d-flex align-items-center gap-3">
                <span class="fw-semibold text-primary">{{ activeQuestion.category }}</span>
                <button
                  type="button"
                  class="btn btn-link btn-sm text-danger text-decoration-none p-0"
                  title="Remove question from journal"
                  @click="deleteQuestion(activeQuestion.id)"
                >
                  <i class="bi bi-trash me-1"></i>Remove
                </button>
              </div>
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

      <!-- Popup to confirm removing a question -->
      <ConfirmModal
        :show="questionToDelete !== null"
        title="Remove this question?"
        message="The question and any reflection you saved for it will be removed from your journal."
        confirm-label="Remove"
        @confirm="confirmDeleteQuestion"
        @cancel="questionToDelete = null"
      />

      <!-- Popup to confirm clearing a reflection -->
      <ConfirmModal
        :show="showClearConfirm"
        title="Clear your reflection?"
        message="Your saved reflection for this question will be removed."
        confirm-label="Clear"
        @confirm="confirmClearResponse"
        @cancel="showClearConfirm = false"
      />
    </div>
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