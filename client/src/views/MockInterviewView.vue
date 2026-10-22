<script setup>
import { ref, reactive, computed, nextTick } from "vue";

// ---- Practice questions (static for now; later fetched from MongoDB)
const questions = ref([
  {
    id: 1,
    category: "Technical",
    text: "Explain the concept of technical design and how you implement it",
    tip: "Outline how you plan before coding, and give one real example.",
  },
  {
    id: 2,
    category: "Collaboration",
    text: "Tell me about a disagreement with a teammate over a technical approach",
    tip: "Focus on how you listened, compromised and what the outcome was.",
  },
  {
    id: 3,
    category: "Problem Solving",
    text: "Describe a difficult bug you encountered and how you diagnosed and fixed it",
    tip: "Walk through your debugging process, the tools you used, and what you learned from it",
  },
]);

const activeId = ref(1);
const responses = reactive({ 1: "", 2: "", 3: "" });
const savedJournal = reactive({});
const showSaveToast = ref(false);
let toastTimer = null;

const active = computed(() =>
  questions.value.find((q) => q.id === activeId.value) || questions.value[0]
);

const wordCount = computed(() => {
  const text = (responses[activeId.value] || "").trim();
  return text ? text.split(/\s+/).length : 0;
});

const isUnsaved = computed(() => {
  const current = (responses[activeId.value] || "").trim();
  const saved = savedJournal[activeId.value]?.content || "";
  return current.length > 0 && current !== saved;
});

const responsePanel = ref(null);

const select = (id) => {
  activeId.value = id;
  showSaveToast.value = false;
  if (window.innerWidth < 992) {
    nextTick(() =>
      responsePanel.value?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    );
  }
};

const clear = () => {
  if (!responses[activeId.value]?.trim()) return;
  if (confirm("Are you sure you want to clear your reflection draft?")) {
    responses[activeId.value] = "";
    showSaveToast.value = false;
  }
};

const save = () => {
  const content = (responses[activeId.value] || "").trim();
  if (!content) return;

  // Save into local journal state (Later: POST / PUT to MongoDB user journal collection)
  savedJournal[activeId.value] = {
    questionId: activeId.value,
    questionText: active.value.text,
    category: active.value.category,
    content: content,
    savedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };

  showSaveToast.value = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    showSaveToast.value = false;
  }, 3000);
};
</script>

<template>
  <main class="p-3 p-lg-4 text-start">
    <!-- Header Card -->
    <div class="card rounded-3 p-3 mb-4 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
      <div>
        <h1 class="h5 mb-1">Gerald's Interview Journal</h1>
        <p class="small mb-0 text-secondary">
          Hi Gerald - Let's turn your experiences into ready-made interview stories
        </p>
      </div>
      <div class="small fw-semibold text-secondary">
        <i class="bi bi-journal-check me-1 text-primary"></i>
        {{ Object.keys(savedJournal).length }} / {{ questions.length }} Saved to Journal
      </div>
    </div>

    <div class="row g-4 px-lg-4">
      <!-- Questions List -->
      <div class="col-12 col-lg-5">
        <section class="card border-0 bg-body-secondary rounded-4 pt-4 pb-3 h-100 overflow-hidden">
          <div class="px-3 px-md-4 pb-3">
            <div class="text-secondary fw-semibold" style="font-size: 0.65rem;">
              GovTech | Fullstack Intern
            </div>
            <h2 class="h6 fw-bold mt-2 mb-1">Practice Questions</h2>
            <div class="text-secondary" style="font-size: 0.7rem;">
              {{ questions.length }} Questions tailored to this role
            </div>
          </div>

          <div class="list-group list-group-flush">
            <button
              v-for="(q, index) in questions"
              :key="q._id || q.id"
              type="button"
              class="list-group-item list-group-item-action d-flex align-items-center gap-3 px-3 px-md-4 py-3 border-top border-secondary-subtle"
              :class="q.id === activeId ? 'q-item-active' : 'bg-transparent'"
              @click="select(q.id)"
            >
              <span class="text-secondary flex-shrink-0" style="width: 1.5rem;">
                {{ String(index + 1).padStart(2, "0") }}
              </span>
              <span class="flex-grow-1">
                <span class="d-flex align-items-center gap-2">
                  <span class="text-primary fw-semibold" style="font-size: 0.7rem;">{{ q.category }}</span>
                  <span
                    v-if="savedJournal[q.id]"
                    class="badge rounded-pill bg-success-subtle text-success"
                    style="font-size: 0.6rem;"
                  >
                    <i class="bi bi-check-circle-fill me-1"></i>Saved
                  </span>
                </span>
                <span class="d-block small text-dark mt-1">{{ q.text }}</span>
              </span>
              <i class="bi bi-chevron-right text-secondary"></i>
            </button>
          </div>
        </section>
      </div>

      <!-- Response Editor -->
      <div class="col-12 col-lg-7">
        <section
          v-if="active"
          ref="responsePanel"
          class="card border-0 bg-body-secondary rounded-4 p-3 p-md-4 h-100 d-flex flex-column response-panel"
        >
          <div class="d-flex justify-content-between small mb-2">
            <span class="text-secondary fw-semibold">
              Question {{ String(active.id).padStart(2, "0") }}
            </span>
            <span class="fw-semibold text-primary">{{ active.category }}</span>
          </div>
          <h2 class="h5 fw-bold mb-3">{{ active.text }}</h2>

          <!-- Tips Box -->
          <div class="inturn-bg text-white rounded-3 p-3 mb-3">
            <div class="fw-semibold small">Helpful Tips</div>
            <div style="font-size: 0.75rem;">{{ active.tip }}</div>
          </div>

          <div class="d-flex justify-content-between align-items-center small mb-2">
            <div class="d-flex align-items-center gap-2">
              <span class="fw-semibold">Your Reflection</span>
              <span v-if="savedJournal[active.id] && !isUnsaved" class="text-secondary" style="font-size: 0.7rem;">
                (Last saved at {{ savedJournal[active.id].savedAt }})
              </span>
              <span v-else-if="isUnsaved" class="text-warning-emphasis" style="font-size: 0.7rem;">
                • Unsaved changes
              </span>
            </div>
            <span class="text-secondary">{{ wordCount }} word{{ wordCount === 1 ? '' : 's' }}</span>
          </div>

          <textarea
            v-model="responses[active.id]"
            class="form-control border-0 rounded-4 p-3 flex-grow-1 reflection-box"
            placeholder="Start writing your response here..."
          ></textarea>

          <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-4">
            <div>
              <span v-if="showSaveToast" class="small fw-semibold text-success">
                <i class="bi bi-check-circle-fill me-1"></i>Saved to your Interview Journal!
              </span>
            </div>

            <div class="d-flex align-items-center gap-3 ms-auto">
              <button
                class="btn btn-link text-secondary text-decoration-none small p-0"
                :disabled="!responses[active.id]?.trim()"
                @click="clear"
              >
                Clear
              </button>
              <button
                class="btn btn-inturn rounded-pill px-3 py-2 small fw-semibold"
                :disabled="!responses[active.id]?.trim()"
                @click="save"
              >
                Save Response
              </button>
            </div>
          </div>
        </section>
      </div>
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

.reflection-box {
  resize: none;
  min-height: 240px;
}

.response-panel {
  scroll-margin-top: 80px;
}
</style>