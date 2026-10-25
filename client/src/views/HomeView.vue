<script setup>
import { ref, onMounted } from 'vue'

// Proves the Vite /api proxy reaches the Express server end to end.
const health = ref(null)
const error = ref(false)

onMounted(async () => {
  try {
    const res = await fetch('/api/health')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    health.value = await res.json()
  } catch {
    error.value = true
  }
})
</script>

<template>
  <section>
    <h1 class="h3">Welcome to Inturn</h1>
    <p class="text-body-secondary">Prepare for internship applications before you submit them: discover roles, find your skill gaps, and practise interviews.</p>
  </section>
</template>
