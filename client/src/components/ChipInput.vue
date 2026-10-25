<script setup>
import { ref } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Type and press Enter' },
  label: { type: String, default: '' },
  id: { type: String, default: () => `chips-${Math.random().toString(36).slice(2, 8)}` },
})
const emit = defineEmits(['update:modelValue'])
const draft = ref('')

function add() {
  const parts = draft.value.split(',').map((s) => s.trim()).filter(Boolean)
  if (!parts.length) { draft.value = ''; return }
  const next = [...props.modelValue]
  for (const p of parts) {
    if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p)
  }
  emit('update:modelValue', next)
  draft.value = ''
}
function remove(i) {
  emit('update:modelValue', props.modelValue.filter((_, idx) => idx !== i))
}
// Enter or comma adds; Backspace on an empty input removes the last chip.
function onKeydown(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    add()
  } else if (e.key === 'Backspace' && !draft.value && props.modelValue.length) {
    remove(props.modelValue.length - 1)
  }
}
</script>

<template>
  <div>
    <label v-if="label" :for="id" class="form-label">{{ label }}</label>
    <div class="input-group">
      <input
        :id="id"
        v-model="draft"
        type="text"
        class="form-control"
        :placeholder="placeholder"
        autocomplete="off"
        @keydown="onKeydown"
      />
      <button type="button" class="btn btn-outline-primary" :disabled="!draft.trim()" @click="add">Add</button>
    </div>
    <ul class="list-unstyled d-flex flex-wrap gap-2 mt-2 mb-0" aria-label="Added items">
      <li
        v-for="(item, i) in modelValue"
        :key="item.toLowerCase()"
        class="badge rounded-pill text-bg-light border d-inline-flex align-items-center gap-1 fs-6 fw-normal py-2 ps-3 pe-2"
      >
        {{ item }}
        <button
          type="button"
          class="btn-close ms-1"
          style="font-size: 0.6rem"
          :aria-label="`Remove ${item}`"
          @click="remove(i)"
        ></button>
      </li>
    </ul>
  </div>
</template>
