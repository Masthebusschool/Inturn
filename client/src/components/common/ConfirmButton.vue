<script setup>
// Inline "click to arm, then confirm or cancel" control. Replaces native confirm().
// Focus moves to Cancel (the safe choice) and the group is labelled by the prompt so
// screen readers announce it. Esc, clicking outside, or tabbing away cancels.
import { ref, watch, nextTick, onBeforeUnmount, useId } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  prompt: { type: String, required: true },
  confirmLabel: { type: String, default: 'Confirm' },
  cancelLabel: { type: String, default: 'Cancel' },
  triggerClass: { type: String, default: 'btn btn-sm btn-outline-danger' },
  triggerAriaLabel: { type: String, default: '' },
  disabled: Boolean,
  busy: Boolean,
  skip: Boolean,
})
const emit = defineEmits(['confirm', 'armed'])

const armed = ref(false)
let armedAt = 0
const rootEl = ref(null)
const triggerEl = ref(null)
const cancelEl = ref(null)
const promptId = useId()

function arm() {
  if (props.disabled || props.busy) return
  if (props.skip) {
    emit('confirm')
    return
  }
  armed.value = true
  armedAt = performance.now()
  emit('armed', true)
  document.addEventListener('pointerdown', onOutside, true)
  nextTick(() => cancelEl.value?.focus())
}

function disarm(restoreFocus = true) {
  if (!armed.value) return
  armed.value = false
  emit('armed', false)
  document.removeEventListener('pointerdown', onOutside, true)
  if (restoreFocus) nextTick(() => triggerEl.value?.focus())
}

function onConfirm() {
  // The confirm button renders where the trigger was; ignore a fast double-click.
  if (performance.now() - armedAt < 350) return
  disarm(true)
  emit('confirm')
}

function onOutside(e) {
  if (rootEl.value && !rootEl.value.contains(e.target)) disarm(false)
}

function onFocusOut(e) {
  if (e.relatedTarget && rootEl.value && !rootEl.value.contains(e.relatedTarget)) disarm(false)
}

watch(() => props.disabled || props.busy, (v) => { if (v) disarm(false) })
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside, true))
</script>

<template>
  <div ref="rootEl" class="cb" :class="{ 'cb-armed': armed }">
    <button v-if="!armed" ref="triggerEl" type="button" :class="triggerClass" :disabled="disabled || busy" :aria-label="triggerAriaLabel || undefined" :aria-busy="busy || undefined" @click="arm">
      <span v-if="busy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ label }}
    </button>
    <div v-else role="group" :aria-labelledby="promptId" class="cb-bar" @keydown.esc.stop.prevent="disarm()" @focusout="onFocusOut">
      <span :id="promptId" class="cb-prompt">{{ prompt }}</span>
      <span class="cb-actions">
        <button type="button" class="btn btn-sm btn-danger" @click="onConfirm">{{ confirmLabel }}</button>
        <button ref="cancelEl" type="button" class="btn btn-sm btn-light border" @click="disarm()">{{ cancelLabel }}</button>
      </span>
    </div>
  </div>
</template>

<style scoped>
.cb { display: inline-flex; max-width: 100%; }
.cb-armed { display: flex; }
.cb-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.375rem 0.75rem; width: 100%; padding: 0.375rem 0.375rem 0.375rem 0.75rem; border: 1px solid var(--bs-danger-border-subtle); border-radius: var(--bs-border-radius); background: var(--bs-danger-bg-subtle); color: var(--bs-danger-text-emphasis); font-size: 0.875rem; line-height: 1.35; animation: cb-in 0.16s ease-out; }
.cb-prompt { flex: 1 1 auto; min-width: 0; }
.cb-actions { display: inline-flex; gap: 0.375rem; flex-shrink: 0; margin-left: auto; }
@keyframes cb-in { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .cb-bar { animation: none; } }
</style>
