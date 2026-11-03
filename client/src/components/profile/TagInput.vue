<script setup>
import { ref, computed } from 'vue'

// A list of tags (skills, industries...). Type and press Enter or comma to add,
// click a suggestion to add it, click × to remove. Duplicates are ignored (any case).
const props = defineProps({
  modelValue: { type: Array, required: true },
  suggestions: { type: Array, default: () => [] },
  max: { type: Number, default: 30 },
  maxLength: { type: Number, default: 50 },
  inputId: { type: String, required: true },
  placeholder: { type: String, default: 'Type and press Enter' },
})
const emit = defineEmits(['update:modelValue'])

const draft = ref('')
const hint = ref('')

const isFull = computed(() => props.modelValue.length >= props.max)
const hasTag = (text) => props.modelValue.some((tag) => tag.toLowerCase() === text.toLowerCase())
const remainingSuggestions = computed(() => props.suggestions.filter((item) => !hasTag(item)))

// Accepts one tag or several separated by commas (e.g. pasted "Python, Java").
function addTag(raw) {
  hint.value = ''
  const tags = [...props.modelValue]
  const tooLong = []

  for (const part of raw.split(',')) {
    const text = part.trim()
    if (!text) continue
    if (tags.some((tag) => tag.toLowerCase() === text.toLowerCase())) {
      hint.value = `"${text}" is already added`
    } else if (tags.length >= props.max) {
      hint.value = `You can add at most ${props.max}`
    } else if (text.length > props.maxLength) {
      hint.value = `Each item must not exceed ${props.maxLength} characters`
      tooLong.push(text)
    } else {
      tags.push(text)
    }
  }

  if (tags.length !== props.modelValue.length) emit('update:modelValue', tags)
  draft.value = tooLong.join(', ') // keep anything too long so it can be shortened
}

function removeTag(index) {
  hint.value = ''
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}

function handleKeydown(event) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    addTag(draft.value)
  } else if (event.key === 'Backspace' && !draft.value && props.modelValue.length) {
    removeTag(props.modelValue.length - 1)
  }
}
</script>

<template>
  <div>
    <div class="tag-box">
      <span v-for="(tag, index) in modelValue" :key="tag" class="tag-inturn tag">
        {{ tag }}
        <button type="button" class="tag-remove" :aria-label="`Remove ${tag}`" @click="removeTag(index)">×</button>
      </span>
      <input
        :id="inputId"
        v-model="draft"
        type="text"
        class="tag-input"
        :placeholder="isFull ? '' : placeholder"
        :disabled="isFull"
        :maxlength="maxLength + 10"
        @keydown="handleKeydown"
        @blur="addTag(draft)"
      />
    </div>
    <div v-if="hint" class="form-text text-danger">{{ hint }}</div>

    <div v-if="remainingSuggestions.length && !isFull" class="suggestions">
      <button
        v-for="item in remainingSuggestions"
        :key="item"
        type="button"
        class="chip-inturn"
        @click="addTag(item)"
      >
        + {{ item }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Looks like .input-inturn, but holds the tags and the real input */
.tag-box {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  min-height: 42px;
  padding: 0.3rem 0.5rem;
  background: var(--inturn-surface);
  border: 1px solid var(--inturn-border-strong);
  border-radius: var(--r-sm);
}

.tag-box:focus-within {
  border-color: var(--inturn-primary);
  box-shadow: 0 0 0 0.2rem rgba(78, 139, 230, 0.25);
}

/* Room for the × button */
.tag {
  gap: 0.25rem;
  padding-right: 0.4rem;
}

.tag-remove {
  border: none;
  background: none;
  color: inherit;
  font-size: 1.1rem;
  line-height: 1;
  padding: 0 0.25rem;
}

.tag-input {
  flex: 1;
  min-width: 140px;
  border: none;
  outline: none;
  padding: 0.25rem;
  background: transparent;
}

.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.75rem;
}
</style>
