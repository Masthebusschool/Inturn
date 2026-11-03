<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { authStore } from '../stores/auth.js'
import { isValidEmail } from '../utils/validators.js'
import { restoreMatchingResume, clearMatchingResume } from "../stores/jobMatch.js";

const router = useRouter()

// Coming from sign up: the new account's email is passed in history state
const form = reactive({ email: history.state?.email ?? '', password: '', rememberMe: false })
const errors = ref([])
const info = ref('')
const submitting = ref(false)


function validate() {
  const list = []
  if (!form.email.trim()) list.push('Email is required')
  else if (!isValidEmail(form.email)) list.push('Email format is invalid')
  if (!form.password) list.push('Password is required')
  return list
}

async function handleLogin() {
  info.value = ''
  errors.value = validate()
  try {
    const user = await authStore.login({ ...form, email: form.email.trim() })
    form.password = ''
    clearMatchingResume()
    await restoreMatchingResume()
    // Education level is required in onboarding, so no education level means onboarding is not done yet
    router.push(user.educationLevel ? '/jobs' : '/onboarding')
  } catch (err) {
    errors.value = err.errors ?? [err.message]
  } 
}



</script>

<template>
  <section class="login-page">
    <img src="../assets/logogogo.jpg" class="brand-logo" alt="Inturn">

    <form class="card-inturn auth-card" novalidate @submit.prevent="handleLogin">
      <h2 class="welcome text-center">Welcome to Inturn</h2>
      <p class="subtitle">Sign in to continue your career prep.</p>

      <div v-if="errors.length" class="alert alert-danger py-2" role="alert">
        <div v-for="error in errors" :key="error">{{ error }}</div>
      </div>
      <div v-if="info" class="alert alert-info py-2" role="status">{{ info }}</div>

      <div class="mb-3">
        <label for="login-email" class="form-label">Email address</label>
        <input
          id="login-email"
          v-model="form.email"
          type="email"
          class="input-inturn"
          autocomplete="email"
          required
        />
      </div>

      <div class="mb-3">
        <label for="login-password" class="form-label">Password</label>
        <input
          id="login-password"
          v-model="form.password"
          type="password"
          class="input-inturn"
          autocomplete="current-password"
          required
        />
      </div>

      <div class="d-flex justify-content-between align-items-center mb-4 small">
        <div class="form-check mb-0">
          <input id="login-remember" v-model="form.rememberMe" type="checkbox" class="form-check-input" />
          <label for="login-remember" class="form-check-label">Remember me</label>
        </div>
      </div>

      <div class="text-center">
        <button type="submit" class="btn-primary-inturn" :disabled="submitting">
          Log in
        </button>
        <p class="mt-3 mb-0 small text-body-secondary">
          Don't have an account? <RouterLink to="/signup">Sign up</RouterLink>
        </p>
      </div>
    </form>
  </section>
</template>

<style scoped>
.login-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 0;
}

.brand-logo {
  height: 120px;
  width: auto;
  padding: 1rem 0;
}

.auth-card {
  width: 100%;
  max-width: 520px;
  padding: 2rem 2.75rem;
}

.welcome {
  font-size: 1.75rem;
  font-weight: 900;
  margin-bottom: 1.25rem;
}

.subtitle {
  font-size: 0.85rem;
  color: var(--inturn-text-muted);
  margin-bottom: 1.5rem;
}

@media (max-width: 576px) {
  .auth-card {
    padding: 1.5rem 1.25rem;
  }
}
</style>
