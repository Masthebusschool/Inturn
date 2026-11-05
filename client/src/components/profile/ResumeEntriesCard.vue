<script setup>
// Add / edit / delete list for the primary resume's experience or projects.
// The parent owns saving: save(list) gets the full new list as plain objects (no _id).
import { ref, computed, useId } from 'vue'
import ConfirmButton from '../common/ConfirmButton.vue'
import { expToForm, projToForm, expFromForm, projFromForm } from '../../utils/resumeForm.js'

const props = defineProps({
  kind: { type: String, required: true }, // 'experience' | 'projects'
  title: { type: String, required: true },
  entries: { type: Array, default: () => [] },
  save: { type: Function, required: true },
})

const isExp = computed(() => props.kind === 'experience')
const noun = computed(() => (isExp.value ? 'experience' : 'project'))
const toForm = (e) => (isExp.value ? expToForm(e) : projToForm(e))
const fromForm = (f) => (isExp.value ? expFromForm(f) : projFromForm(f))
const uid = useId()

const editing = ref(null) // { index, form }; index -1 = new entry appended
const saving = ref(false)
const error = ref('')
// One entry at a time: deleting or adding while a form is open would shift the edited index
const busy = computed(() => saving.value || editing.value !== null)

// A null row stands in for the entry being added, so it renders in the same v-for as the rest
const rows = computed(() => (editing.value?.index === -1 ? [...props.entries, null] : props.entries))
const isEditing = (e, i) => editing.value && editing.value.index === (e ? i : -1)

function range(e) {
  return [e.startDate, e.current ? 'Present' : e.endDate].filter(Boolean).join(' – ')
}

function startEdit(index) {
  error.value = ''
  editing.value = { index, form: toForm(index === -1 ? {} : props.entries[index]) }
}

async function run(list) {
  saving.value = true
  error.value = ''
  try {
    await props.save(list)
    return true
  } catch (e) {
    error.value = e.errors?.[0] ?? e.message ?? 'Could not save.'
    return false
  } finally {
    saving.value = false
  }
}

// Existing entries go back through the form mappers, which also strips _id
const currentList = () => props.entries.map((e) => fromForm(toForm(e)))

async function submit() {
  const { index, form } = editing.value
  const list = currentList()
  if (index === -1) list.push(fromForm(form))
  else list[index] = fromForm(form)
  if (await run(list)) editing.value = null
}

function remove(index) {
  return run(currentList().filter((_, i) => i !== index))
}
</script>

<template>
  <article class="card-inturn">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="section-title mb-0">{{ title }}</h2>
      <button type="button" class="btn-secondary-inturn btn-sm-inturn" :disabled="busy" @click="startEdit(-1)">
        + Add {{ noun }}
      </button>
    </div>

    <p v-if="!rows.length" class="text-body-secondary mb-0">No {{ isExp ? 'experience' : 'projects' }} yet.</p>

    <div v-for="(e, i) in rows" :key="e?._id || `row-${i}`" class="entry">
      <form v-if="isEditing(e, i)" class="card-muted-inturn" novalidate @submit.prevent="submit">
        <div class="row g-2">
          <template v-if="isExp">
            <div class="col-12">
              <label :for="`${uid}-title`" class="form-label small">Title</label>
              <input :id="`${uid}-title`" v-model="editing.form.title" class="input-inturn" />
            </div>
            <div class="col-12">
              <label :for="`${uid}-co`" class="form-label small">Company</label>
              <input :id="`${uid}-co`" v-model="editing.form.company" class="input-inturn" />
            </div>
            <div class="col-12">
              <label :for="`${uid}-loc`" class="form-label small">Location</label>
              <input :id="`${uid}-loc`" v-model="editing.form.location" class="input-inturn" />
            </div>
          </template>
          <div v-else class="col-12">
            <label :for="`${uid}-name`" class="form-label small">Name</label>
            <input :id="`${uid}-name`" v-model="editing.form.name" class="input-inturn" />
          </div>
          <div class="col-6">
            <label :for="`${uid}-s`" class="form-label small">Start</label>
            <input :id="`${uid}-s`" v-model="editing.form.startDate" class="input-inturn" :placeholder="isExp ? 'Jan 2024' : undefined" />
          </div>
          <div class="col-6">
            <label :for="`${uid}-e`" class="form-label small">End</label>
            <input :id="`${uid}-e`" v-model="editing.form.endDate" class="input-inturn" :placeholder="isExp ? 'Aug 2024' : undefined" :disabled="isExp && editing.form.current" />
          </div>
          <div v-if="isExp" class="col-12 d-flex align-items-center">
            <div class="form-check">
              <input :id="`${uid}-c`" v-model="editing.form.current" type="checkbox" class="form-check-input" />
              <label :for="`${uid}-c`" class="form-check-label">I currently work here</label>
            </div>
          </div>
          <div class="col-12">
            <label :for="`${uid}-b`" class="form-label small">Bullets (one per line)</label>
            <textarea :id="`${uid}-b`" v-model="editing.form.bulletsText" class="input-inturn" :rows="isExp ? 4 : 3"></textarea>
          </div>
          <div class="col-12">
            <label :for="`${uid}-k`" class="form-label small">{{ isExp ? 'Skills used' : 'Skills / tech stack' }} (comma-separated)</label>
            <input :id="`${uid}-k`" v-model="editing.form.skillsText" class="input-inturn" />
          </div>
        </div>
        <div v-if="error" class="alert alert-danger py-2 small mt-3 mb-0" role="alert">{{ error }}</div>
        <div class="d-flex gap-2 mt-3">
          <button type="submit" class="btn-primary-inturn btn-sm-inturn" :disabled="saving">{{ saving ? 'Saving…' : 'Save' }}</button>
          <button type="button" class="btn-neutral-inturn btn-sm-inturn" :disabled="saving" @click="editing = null">Cancel</button>
        </div>
      </form>

      <template v-else>
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
          <div class="min-w-0">
            <div class="fw-semibold">{{ (isExp ? e.title : e.name) || 'Untitled' }}</div>
            <div v-if="isExp && (e.company || e.location)" class="small text-body-secondary">
              {{ [e.company, e.location].filter(Boolean).join(' · ') }}
            </div>
            <div v-if="range(e)" class="small text-body-secondary">{{ range(e) }}</div>
          </div>
          <div class="d-flex flex-wrap gap-2">
            <button type="button" class="btn-neutral-inturn btn-sm-inturn" :disabled="busy" @click="startEdit(i)">Edit</button>
            <ConfirmButton
              label="Delete"
              :prompt="`Delete this ${noun}?`"
              confirm-label="Delete"
              :trigger-aria-label="`Delete ${(isExp ? e.title : e.name) || noun}`"
              :busy="saving"
              :disabled="busy"
              @confirm="remove(i)"
            />
          </div>
        </div>
        <ul v-if="e.bullets?.length" class="small mt-2 mb-0 ps-3">
          <li v-for="(b, bi) in e.bullets" :key="bi">{{ b }}</li>
        </ul>
        <ul v-if="e.skills?.length" class="chips mt-2">
          <li v-for="s in e.skills" :key="s" class="tag-inturn">{{ s }}</li>
        </ul>
      </template>
    </div>

    <div v-if="error && !editing" class="alert alert-danger py-2 small mb-0" role="alert">{{ error }}</div>
  </article>
</template>

<style scoped>
.entry:not(:last-child) {
  margin-bottom: 1rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  list-style: none;
  padding: 0;
  margin-bottom: 0;
  font-size: 0.75rem;
}

.min-w-0 {
  min-width: 0;
}
</style>
