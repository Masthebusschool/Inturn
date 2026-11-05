<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { api } from '../../lib/api.js'
import { sectionLabel } from '../../lib/skillgap.js'
import ConfirmButton from '../common/ConfirmButton.vue'

const props = defineProps({
  resultId: { type: String, required: true },
  messages: { type: Array, default: () => [] },
  focus: { type: Array, default: () => [] },
  draft: { type: Object, required: true },
  appliedIds: { type: [Set, Array], default: () => [] },
})
const emit = defineEmits(['apply', 'remove-focus', 'clear-focus', 'update:messages'])

const input = ref('')
const sending = ref(false)
const error = ref(null) // { message, code }
const dismissed = ref(new Set()) // session-local; not persisted
const log = ref(null)
const applied = computed(() => new Set(props.appliedIds))

async function send() {
  const message = input.value.trim()
  if (!message || sending.value) return
  sending.value = true
  error.value = null
  try {
    const res = await api(`/api/skillgap/${props.resultId}/tailor`, {
      method: 'POST',
      body: { message, focusKeys: props.focus.map((r) => r.key), draft: props.draft },
    })
    emit('update:messages', [...props.messages, ...res.messages])
    input.value = ''
  } catch (e) {
    // Keep the typed message so Retry (or Enter) resends it.
    error.value = { message: e.message, code: e.code }
  } finally {
    sending.value = false
  }
}

async function clear() {
  try {
    await api(`/api/skillgap/${props.resultId}/tailor`, { method: 'DELETE' })
    emit('update:messages', [])
    dismissed.value = new Set()
    error.value = null
    // The Clear trigger disables itself once the log is empty, so hand focus to the composer.
    nextTick(() => document.getElementById('sg-chat-input')?.focus())
  } catch (e) {
    error.value = { message: e.message, code: e.code }
  }
}

function onKey(e) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    send()
  }
}

const dismiss = (id) => { dismissed.value = new Set(dismissed.value).add(id) }
const visible = (m) => (m.suggestions || []).filter((s) => !dismissed.value.has(s.id))

watch(() => [props.messages.length, sending.value], async () => {
  await nextTick()
  if (log.value) log.value.scrollTop = log.value.scrollHeight
})
</script>

<template>
  <div class="sg-chat d-flex flex-column h-100">
    <div class="sg-focus px-3 py-2 border-bottom">
      <div v-if="focus.length" class="d-flex flex-wrap align-items-center gap-2">
        <span class="small text-body-secondary me-1">Tailoring for:</span>
        <span v-for="r in focus" :key="r.key" class="badge rounded-pill text-bg-primary d-inline-flex align-items-center gap-1 fw-normal ps-2 pe-1">
          {{ r.text }}
          <button type="button" class="btn-close btn-close-white sg-chip-x" :aria-label="`Stop tailoring for ${r.text}`" @click="emit('remove-focus', r.key)"></button>
        </span>
        <button type="button" class="btn-link-inturn ms-1" @click="emit('clear-focus')">Clear all</button>
      </div>
      <p v-else class="small text-body-secondary mb-0">Click a missing or partial requirement to tailor for it, or ask anything.</p>
    </div>

    <div ref="log" class="sg-log flex-grow-1 px-3 py-3" aria-live="polite" aria-relevant="additions" role="log" tabindex="0" aria-label="Tailoring conversation">
      <p v-if="!messages.length && !sending" class="small text-body-secondary text-center my-4">
        Ask for help strengthening your draft. Suggestions only use facts from your draft, your profile, or what you tell me here.
      </p>
      <div v-for="(m, i) in messages" :key="i" class="sg-msg" :class="m.role === 'user' ? 'is-user' : 'is-bot'">
        <div class="sg-bubble">
          <span v-if="m.asking" class="badge text-bg-warning mb-1">Needs your answer</span>
          <div class="sg-text">{{ m.text }}</div>
        </div>
        <div v-for="s in visible(m)" :key="s.id" class="sg-sugg card-inturn p-0">
          <div class="p-2">
            <div class="small fw-semibold mb-1">{{ sectionLabel(draft, s.sectionId) }}</div>
            <div v-if="s.original" class="small text-body-secondary mb-1">Replaces: <s>{{ s.original }}</s></div>
            <template v-if="s.field === 'entry'">
              <div class="sg-text fw-semibold">{{ s.title }}{{ s.company ? ' — ' + s.company : '' }}</div>
              <ul class="mb-0 ps-3"><li v-for="(b, j) in s.bullets" :key="j" class="sg-text">{{ b }}</li></ul>
            </template>
            <div v-else class="sg-text">{{ s.field === 'skills' ? 'Add: ' : '' }}{{ s.text }}</div>
            <div v-if="s.requirementKeys?.length" class="d-flex flex-wrap gap-2 mt-1">
              <span v-for="k in s.requirementKeys" :key="k" class="badge text-bg-light border fw-normal">{{ k.replace(/-/g, ' ') }}</span>
            </div>
            <div class="d-flex gap-2 mt-2">
              <button type="button" class="btn-primary-inturn btn-sm-inturn" :disabled="applied.has(s.id)" @click="emit('apply', s)">{{ applied.has(s.id) ? (s.field === 'entry' ? 'Added' : 'Applied') : (s.field === 'entry' ? 'Add' : 'Apply') }}</button>
              <button v-if="!applied.has(s.id)" type="button" class="btn-neutral-inturn btn-sm-inturn" @click="dismiss(s.id)">Dismiss</button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="sending" class="sg-msg is-bot" role="status">
        <div class="sg-bubble text-body-secondary"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Thinking… usually 5–20s</div>
      </div>
    </div>

    <div class="border-top p-3">
      <div aria-live="assertive">
        <div v-if="error" class="alert alert-danger py-2 small d-flex justify-content-between align-items-center gap-2" role="alert">
          <span>{{ error.message }}</span>
          <button v-if="error.code !== 'ai_daily_quota'" type="button" class="btn-danger-inturn btn-sm-inturn flex-shrink-0" :disabled="sending" @click="send">Retry</button>
        </div>
      </div>
      <label for="sg-chat-input" class="visually-hidden">Message to the tailoring assistant</label>
      <textarea id="sg-chat-input" v-model="input" class="input-inturn" rows="2" maxlength="2000" placeholder="Ask about your draft…" :disabled="sending" @keydown="onKey"></textarea>
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-2">
        <ConfirmButton label="Clear conversation" trigger-class="btn-link-inturn text-danger" prompt="Clear this conversation? Suggestions already applied to your draft stay." confirm-label="Clear" :disabled="!messages.length || sending" @confirm="clear" />
        <button type="button" class="btn-primary-inturn btn-sm-inturn ms-auto" :disabled="!input.trim() || sending" @click="send">Send</button>
      </div>
      <div class="form-text">Enter to send, Shift+Enter for a new line.</div>
    </div>
  </div>
</template>

<style scoped>
.sg-chat { min-height: 0; }
.sg-log { overflow-y: auto; min-height: 0; display: flex; flex-direction: column; gap: 0.75rem; }
.sg-msg { display: flex; flex-direction: column; gap: 0.5rem; max-width: 92%; }
.sg-msg.is-user { align-self: flex-end; align-items: flex-end; }
.sg-msg.is-bot { align-self: flex-start; align-items: stretch; }
.sg-bubble { padding: 0.75rem 1rem; border-radius: var(--r-md); font-size: 0.9rem; }
.is-user .sg-bubble { background: var(--bs-primary); color: #fff; border-bottom-right-radius: var(--bs-border-radius-sm); }
.is-bot .sg-bubble { background: var(--bs-tertiary-bg); border: 1px solid var(--bs-border-color); border-bottom-left-radius: var(--bs-border-radius-sm); }
.sg-text { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.6; }
.sg-sugg { font-size: 0.9rem; border-left: 3px solid var(--bs-primary); }
.sg-chip-x { font-size: 0.55rem; }
</style>
