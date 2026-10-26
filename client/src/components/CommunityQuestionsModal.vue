<script setup>
import { onMounted, onUnmounted } from "vue";

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  communityQuestions: {
    type: Array,
    default: () => [],
  },
  existingQuestions: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["close", "add-question"]);

// Check by ID (sourceId) so punctuation or capitalization changes don't allow duplicates
function isAlreadyAdded(communityQ) {
  for (const q of props.existingQuestions) {
    if (q.sourceId === communityQ.id) {
      return true;
    }
  }
  return false;
}

// Allow closing the modal with the Escape key
function handleKeydown(event) {
  if (event.key === "Escape" && props.show) {
    emit("close");
  }
}

onMounted(() => window.addEventListener("keydown", handleKeydown));
onUnmounted(() => window.removeEventListener("keydown", handleKeydown));
</script>

<template>
  <div
    v-if="show"
    class="modal-backdrop-custom d-flex align-items-center justify-content-center p-3 text-start"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    @click.self="emit('close')"
  >
    <div
      class="card border-0 rounded-4 shadow-lg w-100 modal-card overflow-hidden"
    >
      <!-- Modal Header -->
      <div
        class="p-4 border-bottom d-flex justify-content-between align-items-start gap-3 bg-white"
      >
        <div class="d-flex align-items-center gap-3">
          <div
            class="rounded-4 bg-primary-subtle text-primary d-flex align-items-center justify-content-center flex-shrink-0"
            style="width: 52px; height: 52px"
          >
            <i class="bi bi-people fs-4"></i>
          </div>
          <div>
            <div class="text-primary text-uppercase fw-bold small">
              Powered by Interview Intel
            </div>
            <h2 id="modal-title" class="h4 fw-bold mb-1">
              Community interview questions
            </h2>
            <p class="text-secondary small mb-0">
              Practice questions reported by students after real interviews.
            </p>
          </div>
        </div>

        <button
          type="button"
          class="btn btn-light border rounded-3"
          aria-label="Close modal"
          @click="emit('close')"
        >
          <i class="bi bi-x-lg text-secondary"></i>
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-4 bg-body-tertiary overflow-auto" style="max-height: 75vh">
        <!-- Empty State -->
        <div v-if="communityQuestions.length === 0" class="text-center py-5">
          <i class="bi bi-chat-square-quote fs-1 text-secondary"></i>
          <h3 class="h6 fw-bold mt-3 mb-1">No community questions yet</h3>
          <p class="text-secondary small mb-0">
            Questions shared by students in Interview Intel will appear here.
          </p>
        </div>

        <!-- 2x2 Grid -->
        <div v-else class="row g-3">
          <div
            v-for="cq in communityQuestions"
            :key="cq.id"
            class="col-12 col-md-6"
          >
            <div
              class="card border rounded-4 p-3 p-sm-4 h-100 d-flex flex-column justify-content-between bg-white"
            >
              <div class="min-w-0 text-break">
                <!-- Company Info & Category Badge -->
                <div
                  class="d-flex justify-content-between align-items-start gap-2 mb-3"
                >
                  <div class="d-flex align-items-center gap-2">
                    <div
                      class="rounded-3 bg-primary-subtle text-primary fw-bold d-flex align-items-center justify-content-center flex-shrink-0"
                      style="width: 40px; height: 40px"
                    >
                      {{ cq.company?.[0] || "?" }}
                    </div>
                    <div>
                      <div class="fw-bold small text-dark">
                        {{ cq.company || "Unknown Company" }}
                      </div>
                      <div class="text-secondary small">
                        {{ cq.role || "Intern" }}
                      </div>
                    </div>
                  </div>
                  <span
                    class="badge rounded-pill bg-primary-subtle text-primary px-3 py-2"
                  >
                    {{ cq.category || "General" }}
                  </span>
                </div>

                <!-- Question Text -->
                <h3 class="h6 fw-bold text-dark mb-2">{{ cq.text }}</h3>

                <!-- Anonymous Attribution & Upvotes -->
                <p class="text-secondary small mb-3">
                  Shared anonymously &middot; {{ cq.upvotes ?? 0 }} community
                  upvotes
                </p>
              </div>

              <!-- Add to Journal Button -->
              <button
                type="button"
                class="btn w-100 rounded-3 py-2 small fw-semibold"
                :class="
                  isAlreadyAdded(cq)
                    ? 'btn-success-subtle text-success'
                    : 'btn-add-journal'
                "
                :disabled="isAlreadyAdded(cq)"
                @click="emit('add-question', cq)"
              >
                <span v-if="isAlreadyAdded(cq)">
                  <i class="bi bi-check-lg me-1"></i>Added to journal
                </span>
                <span v-else>
                  <i class="bi bi-plus-lg me-1"></i>Add to journal
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop-custom {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1055;
}
.modal-card {
  max-width: 900px;
}
.btn-add-journal {
  background-color: #eef4ff;
  border: 1px solid #cfe0fc;
  color: #2b6cb0;
}
.btn-add-journal:hover {
  background-color: #e1edfd;
  border-color: #4a86e8;
}
</style>
