<script setup>
import { computed, ref } from 'vue'
import { fmtDate } from '../../lib/skillgap.js'
import ConfirmButton from '../common/ConfirmButton.vue'

const props = defineProps({
  tasks: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  actionError: { type: String, default: '' },
  busyId: { type: String, default: null },
})
const emit = defineEmits(['toggle', 'remove'])

const showDone = ref(false)
const armedId = ref('')

// Deadline ascending with missing last, then oldest first; sorted here so an un-ticked row
// lands in its right place without a refetch.
function byDeadline(a, b) {
  if (a.deadline && b.deadline) {
    const d = new Date(a.deadline) - new Date(b.deadline)
    if (d) return d
  } else if (a.deadline) return -1
  else if (b.deadline) return 1
  return new Date(a.createdAt) - new Date(b.createdAt)
}
const pending = computed(() => props.tasks.filter((t) => t.status !== 'done').sort(byDeadline))
const done = computed(() => props.tasks.filter((t) => t.status === 'done').sort(byDeadline))
const rows = computed(() => (showDone.value ? [...pending.value, ...done.value] : pending.value))

function sourceHint(t) {
  return [...new Set((t.sources || []).map((s) => s.job?.company || s.job?.title).filter(Boolean))].join(', ')
}
</script>

<template>
  <div class="card shadow-sm">
    <div class="card-body p-4 pb-2">
      <div class="d-flex align-items-center gap-2">
        <h2 class="h4 fw-semibold mb-0">Skill to-do</h2>
        <span v-if="pending.length" class="badge text-bg-primary">{{ pending.length }}</span>
      </div>
      <p class="small text-body-secondary mb-0">Missing and partial skills from all your analyses</p>
    </div>
    <div v-if="loading" class="px-3 pb-3 text-body-secondary small" role="status">Loading…</div>
    <div v-else-if="error" class="px-3 pb-3 text-danger-emphasis small">{{ error }}</div>
    <template v-else>
      <p v-if="!tasks.length" class="px-3 pb-3 mb-0 text-body-secondary">Nothing here yet — skills you're missing or only partly match in an analysis are added automatically.</p>
      <template v-else>
        <p v-if="actionError" class="px-3 small text-danger-emphasis mb-2" role="alert">{{ actionError }}</p>
        <p v-if="!rows.length" class="px-3 pb-2 mb-0 text-body-secondary small">All caught up.</p>
        <ul v-else class="list-group list-group-flush sg-todo">
          <li v-for="t in rows" :key="t._id" class="list-group-item d-flex align-items-start gap-3" :class="{ 'flex-wrap': armedId === t._id }">
            <input :id="`todo-${t._id}`" type="checkbox" class="form-check-input mt-1 flex-shrink-0" :checked="t.status === 'done'" :disabled="busyId === t._id" @change="emit('toggle', t)" />
            <div class="min-w-0 flex-grow-1">
              <label :for="`todo-${t._id}`" class="fw-semibold d-block" :class="{ 'text-decoration-line-through text-body-secondary': t.status === 'done' }">{{ t.skillText || t.skillKey }}</label>
              <div class="small text-body-secondary d-flex align-items-center gap-1 min-w-0">
                <span class="badge text-bg-light border fw-normal flex-shrink-0">{{ t.deadline ? `Due ${fmtDate(t.deadline)}` : 'No deadline' }}</span>
                <span v-if="sourceHint(t)" class="text-truncate">· {{ sourceHint(t) }}</span>
              </div>
            </div>
            <ConfirmButton :class="armedId === t._id ? 'w-100' : 'ms-auto flex-shrink-0'" label="Remove" trigger-class="btn btn-sm btn-link text-body-secondary p-0" :trigger-aria-label="`Remove ${t.skillText || t.skillKey}`" prompt="Remove from your to-do list?" confirm-label="Remove" :disabled="busyId === t._id" @armed="(on) => { armedId = on ? t._id : (armedId === t._id ? '' : armedId) }" @confirm="emit('remove', t)" />
          </li>
        </ul>
        <div v-if="done.length" class="px-3 py-2 border-top">
          <button type="button" class="btn btn-sm btn-link p-0" :aria-expanded="showDone" @click="showDone = !showDone">{{ showDone ? 'Hide' : 'Show' }} completed ({{ done.length }})</button>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.min-w-0 { min-width: 0; }
.sg-todo { max-height: 26rem; overflow-y: auto; }
</style>
