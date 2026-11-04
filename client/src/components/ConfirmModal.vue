<script setup>
import { onMounted, onUnmounted } from "vue";

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: "Are you sure?",
  },
  message: {
    type: String,
    default: "",
  },
  confirmLabel: {
    type: String,
    default: "Delete",
  },
});

const emit = defineEmits(["confirm", "cancel"]);

// Allow closing the popup with the Escape key
function handleKeydown(event) {
  if (event.key === "Escape" && props.show) {
    emit("cancel");
  }
}

onMounted(() => window.addEventListener("keydown", handleKeydown));
onUnmounted(() => window.removeEventListener("keydown", handleKeydown));
</script>

<template>
  <div
    v-if="show"
    class="confirm-backdrop d-flex align-items-center justify-content-center p-3 text-start"
    role="dialog"
    aria-modal="true"
    @click.self="emit('cancel')"
  >
    <div class="card border-0 rounded-4 shadow-lg w-100 confirm-card p-4">
      <h2 class="h5 fw-bold mb-2">{{ title }}</h2>
      <p class="text-secondary mb-4">{{ message }}</p>

      <div class="d-flex justify-content-end gap-2">
        <button
          type="button"
          class="btn btn-outline-secondary rounded-3"
          @click="emit('cancel')"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-danger rounded-3"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1060;
}
.confirm-card {
  max-width: 420px;
}
</style>