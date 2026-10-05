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
    <p>
      <span v-if="error" class="badge text-bg-danger">API: unreachable</span>
      <span v-else-if="health" class="badge text-bg-success">API: {{ health.status }} / db: {{ health.db }}</span>
      <span v-else class="badge text-bg-secondary">Checking API...</span>
    </p>
    <div class="alert alert-info">Coming soon.</div>
  </section>
</template>
