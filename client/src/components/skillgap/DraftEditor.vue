<script setup>
import { ref, watch, nextTick } from 'vue'
import ChipInput from '../ChipInput.vue'
import ConfirmButton from '../common/ConfirmButton.vue'
import { cloneDraft } from '../../lib/skillgap.js'

const props = defineProps({
  modelValue: { type: Object, required: true },
  highlight: { type: Object, default: null }, // { fieldId, n } — n changes on every request
})
const emit = defineEmits(['update:modelValue', 'reset'])
const root = ref(null)

// Emit a fresh object per edit (never mutate the prop) so the parent's deep watch and draftKey stay simple.
function edit(fn) {
  const next = cloneDraft(props.modelValue)
  fn(next)
  emit('update:modelValue', next)
}

const lists = { experience: (d) => d.experience, project: (d) => d.projects }
const blankEntry = { experience: () => ({ title: '', company: '', bullets: [''] }), project: () => ({ name: '', bullets: [''] }) }
const addEntry = (kind) => edit((d) => lists[kind](d).push(blankEntry[kind]()))
const removeEntry = (kind, i) => edit((d) => lists[kind](d).splice(i, 1))
const setField = (kind, i, key, v) => edit((d) => { lists[kind](d)[i][key] = v })
const setBullet = (kind, i, j, v) => edit((d) => { lists[kind](d)[i].bullets[j] = v })
const addBullet = (kind, i) => edit((d) => lists[kind](d)[i].bullets.push(''))
const removeBullet = (kind, i, j) => edit((d) => lists[kind](d)[i].bullets.splice(j, 1))

// Textarea grows with its content instead of scrolling inside a tiny box.
const fit = (el) => { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }
const vAutosize = { mounted: fit, updated: fit }

watch(() => props.highlight?.n, async () => {
  if (!props.highlight?.fieldId) return
  await nextTick() // an applied suggestion may have just added the target bullet
  const el = root.value?.querySelector(`[data-field="${props.highlight.fieldId}"]`)
  if (!el) return
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' })
  el.classList.remove('sg-flash')
  void el.offsetWidth // restart the animation if the same field is flashed twice
  el.classList.add('sg-flash')
  setTimeout(() => el.classList.remove('sg-flash'), 2000)
})

const icon = { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'aria-hidden': 'true' }
</script>

<template>
  <div ref="root" class="card shadow-sm">
    <div class="card-body p-4">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h2 class="h4 fw-semibold mb-0">Resume draft</h2>
          <p class="small text-body-secondary mb-0">Edit freely — the score updates a few seconds after you stop typing.</p>
        </div>
        <ConfirmButton label="Reset to AI draft" trigger-class="btn btn-sm btn-outline-secondary" prompt="Reset to the original AI draft? Your edits will be lost." confirm-label="Reset draft" @confirm="emit('reset')" />
      </div>

      <div class="sg-field mb-4" data-field="summary">
        <label for="sg-summary" class="form-label fw-semibold">Summary</label>
        <textarea id="sg-summary" v-autosize class="form-control" rows="3" :value="modelValue.summary" @input="edit((d) => { d.summary = $event.target.value })"></textarea>
      </div>

      <div class="sg-field mb-4" data-field="skills">
        <ChipInput id="sg-skills" label="Skills" :model-value="modelValue.skills" placeholder="Add a skill and press Enter" @update:model-value="(v) => edit((d) => { d.skills = v })" />
      </div>

      <template v-for="kind in ['experience', 'project']" :key="kind">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h3 class="h6 fw-semibold mb-0">{{ kind === 'experience' ? 'Experience' : 'Projects' }}</h3>
          <button type="button" class="btn btn-sm btn-outline-primary" @click="addEntry(kind)">
            <svg v-bind="icon" class="me-1"><path d="M8 3v10M3 8h10" /></svg>Add {{ kind === 'experience' ? 'role' : 'project' }}
          </button>
        </div>
        <p v-if="!lists[kind](modelValue).length" class="small text-body-secondary">None yet.</p>
        <div v-for="(entry, i) in lists[kind](modelValue)" :key="`${kind}-${i}`" class="sg-entry mb-3">
          <div class="d-flex gap-2 align-items-end sg-field" :data-field="`${kind}:${i}:head`">
            <div class="flex-grow-1">
              <label :for="`sg-${kind}-${i}-a`" class="form-label small mb-1">{{ kind === 'experience' ? 'Title' : 'Project name' }}</label>
              <input :id="`sg-${kind}-${i}-a`" class="form-control form-control-sm" :value="kind === 'experience' ? entry.title : entry.name" @input="setField(kind, i, kind === 'experience' ? 'title' : 'name', $event.target.value)" />
            </div>
            <div v-if="kind === 'experience'" class="flex-grow-1">
              <label :for="`sg-${kind}-${i}-b`" class="form-label small mb-1">Company</label>
              <input :id="`sg-${kind}-${i}-b`" class="form-control form-control-sm" :value="entry.company" @input="setField(kind, i, 'company', $event.target.value)" />
            </div>
            <button type="button" class="btn btn-sm btn-outline-danger sg-icon-btn" :aria-label="`Remove ${kind === 'experience' ? 'role' : 'project'} ${entry.title || entry.name || i + 1}`" @click="removeEntry(kind, i)">
              <svg v-bind="icon"><path d="M3 4h10M6.5 4V2.5h3V4M5 4l.5 9h5L11 4" /></svg>
            </button>
          </div>
          <ul class="list-unstyled mt-2 mb-1 d-flex flex-column gap-2">
            <li v-for="(b, j) in entry.bullets" :key="j" class="d-flex gap-2 align-items-start sg-field" :data-field="`${kind}:${i}:bullet:${j}`">
              <span class="sg-dot" aria-hidden="true"></span>
              <textarea v-autosize class="form-control form-control-sm" rows="1" :aria-label="`Bullet ${j + 1} of ${entry.title || entry.name || 'entry ' + (i + 1)}`" :value="b" @input="setBullet(kind, i, j, $event.target.value)"></textarea>
              <button type="button" class="btn btn-sm btn-outline-secondary sg-icon-btn" :aria-label="`Remove bullet ${j + 1}`" @click="removeBullet(kind, i, j)">
                <svg v-bind="icon"><path d="M4 4l8 8M12 4l-8 8" /></svg>
              </button>
            </li>
          </ul>
          <button type="button" class="btn btn-sm btn-link p-0" @click="addBullet(kind, i)">+ Add bullet</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.sg-entry { border: 1px solid var(--bs-border-color); border-radius: 0.5rem; padding: 1rem; background: var(--bs-tertiary-bg); }
.sg-icon-btn { width: 2.25rem; height: 2.25rem; padding: 0; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.sg-dot { width: 0.4rem; height: 0.4rem; border-radius: 50%; background: var(--bs-secondary-color); margin-top: 0.8rem; flex-shrink: 0; }
textarea.form-control { resize: none; overflow: hidden; }
.sg-field { border-radius: 0.5rem; }
.sg-flash { animation: sg-flash 2s ease-out; }
@keyframes sg-flash {
  0%, 60% { box-shadow: 0 0 0 0.25rem var(--bs-primary-bg-subtle), 0 0 0 0.3rem var(--bs-primary); }
  100% { box-shadow: 0 0 0 0.25rem transparent, 0 0 0 0.3rem transparent; }
}
@media (prefers-reduced-motion: reduce) { .sg-flash { animation: none; box-shadow: 0 0 0 0.25rem var(--bs-primary-bg-subtle); } }
</style>
