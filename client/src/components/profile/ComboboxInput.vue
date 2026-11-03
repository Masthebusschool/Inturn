<script setup>
import { ref, computed, watch, nextTick } from 'vue'

// Searchable text input that also accepts free text: the typed text IS the value.
const props = defineProps({
  modelValue: { type: String, required: true },
  options: { type: Array, default: () => [] },
  inputId: { type: String, required: true },
  placeholder: { type: String, default: '' },
  maxLength: { type: Number, default: 100 },
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const active = ref(-1)
const listRef = ref(null)

const listId = computed(() => `${props.inputId}-listbox`)
const optionId = (i) => `${props.inputId}-option-${i}`

const matches = computed(() => {
  const q = props.modelValue.trim().toLowerCase()
  return q ? props.options.filter((o) => o.toLowerCase().includes(q)) : props.options
})
const expanded = computed(() => open.value && matches.value.length > 0)

watch(matches, () => { active.value = -1 })

function onInput(event) {
  emit('update:modelValue', event.target.value)
  open.value = true
}

function select(option) {
  emit('update:modelValue', option)
  open.value = false
  active.value = -1
}

function move(step) {
  if (!matches.value.length) return
  open.value = true
  const n = matches.value.length
  active.value = (active.value + step + n) % n
  nextTick(() => listRef.value?.children[active.value]?.scrollIntoView({ block: 'nearest' }))
}

function onEnter(event) {
  if (expanded.value && active.value >= 0) {
    event.preventDefault()
    select(matches.value[active.value])
  }
}
</script>

<template>
  <div class="combobox">
    <input
      :id="inputId"
      :value="modelValue"
      type="text"
      class="input-inturn"
      role="combobox"
      autocomplete="off"
      aria-autocomplete="list"
      :aria-expanded="expanded"
      :aria-controls="listId"
      :aria-activedescendant="expanded && active >= 0 ? optionId(active) : undefined"
      :placeholder="placeholder"
      :maxlength="maxLength"
      @input="onInput"
      @focus="open = true"
      @blur="open = false"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter="onEnter"
      @keydown.esc="open = false"
      @keydown.tab="open = false"
    />
    <ul v-show="expanded" :id="listId" ref="listRef" class="combobox-list" role="listbox">
      <li
        v-for="(option, i) in matches"
        :id="optionId(i)"
        :key="option"
        role="option"
        :aria-selected="i === active"
        :class="{ active: i === active }"
        @mousedown.prevent="select(option)"
        @mousemove="active = i"
      >
        {{ option }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.combobox {
  position: relative;
}

.combobox-list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 20;
  max-height: 240px;
  overflow-y: auto;
  margin: 0;
  padding: 0.25rem;
  list-style: none;
  background: var(--inturn-surface);
  border: 1px solid var(--inturn-border);
  border-radius: var(--r-md);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
}

.combobox-list li {
  padding: 0.5rem 0.75rem;
  border-radius: var(--r-sm);
  cursor: pointer;
}

.combobox-list li.active {
  background: var(--inturn-primary-soft);
  color: var(--inturn-primary-hover);
}
</style>
