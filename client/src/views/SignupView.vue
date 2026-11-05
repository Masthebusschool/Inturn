<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { authStore } from '../stores/auth.js'
import { isValidEmail, PASSWORD_RULES } from '../utils/validators.js'

const router = useRouter()
const form = reactive({ name: '', email: '', password: '', confirmPassword: '' })
const errors = ref([])
const submitting = ref(false)

function validate() {
  const list = []
  const name = form.name.trim()
  if (!name) list.push('Name is required')
  else if (name.length > 50) list.push('Name must not exceed 50 characters')

  if (!form.email.trim()) list.push('Email is required')
  else if (!isValidEmail(form.email)) list.push('Email format is invalid')

  for (const rule of PASSWORD_RULES) {
    if (!rule.test(form.password)) list.push(`Password: ${rule.label.toLowerCase()}`)
  }
  if (form.confirmPassword !== form.password) list.push('Confirm password and password do not match')
  return list
}

async function handleSignup() {
  errors.value = validate()
  if (errors.value.length > 0) return

  submitting.value = true
  try {
    const user = await authStore.signup({ ...form, name: form.name.trim(), email: form.email.trim() })
    form.password = ''
    form.confirmPassword = ''
    // Fresh signup never has educationLevel set yet, but match login's redirect logic in case it ever does
    router.push(user.educationLevel ? '/jobs' : '/onboarding')
  } catch (err) {
    errors.value = err.errors ?? [err.message]
  } finally {
    submitting.value = false
  }
}

</script>

<template>
  <section class="signup-page">
    <form class="card-inturn auth-card" novalidate @submit.prevent="handleSignup">
      <RouterLink to="/" class="btn-link-inturn back-link"><i class="bi bi-arrow-left"></i>Back</RouterLink>
      <img src="../assets/logogogo.jpg" class="brand-logo" alt="Inturn">
      <h2 class="welcome text-center">Create your account</h2>
      <p class="subtitle">Start preparing for your next internship.</p>

      <div v-if="errors.length" class="alert alert-danger py-2" role="alert">
        <div v-for="error in errors" :key="error">{{ error }}</div>
      </div>

      <div class="mb-3">
        <label for="signup-name" class="form-label">Name</label>
        <input
          id="signup-name"
          v-model="form.name"
          type="text"
          class="input-inturn"
          autocomplete="name"
          maxlength="50"
          required
        />
      </div>

      <div class="mb-3">
        <label for="signup-email" class="form-label">Email address</label>
        <input
          id="signup-email"
          v-model="form.email"
          type="email"
          class="input-inturn"
          autocomplete="email"
          required
        />
      </div>

      <div class="mb-3">
        <label for="signup-password" class="form-label">Password</label>
        <input
          id="signup-password"
          v-model="form.password"
          type="password"
          class="input-inturn"
          autocomplete="new-password"
          aria-describedby="password-rules"
          required
        />
        <ul id="password-rules" class="password-rules">
          <li v-for="rule in PASSWORD_RULES" :key="rule.label" :class="{ met: rule.test(form.password) }">
            {{ rule.test(form.password) ? '✓' : '•' }} {{ rule.label }}
          </li>
        </ul>
      </div>

      <div class="mb-4">
        <label for="signup-confirm" class="form-label">Confirm password</label>
        <input
          id="signup-confirm"
          v-model="form.confirmPassword"
          type="password"
          class="input-inturn"
          autocomplete="new-password"
          required
        />
      </div>

      <div class="text-center">
        <button type="submit" class="btn-primary-inturn" :disabled="submitting">
          {{ submitting ? 'Creating account...' : 'Sign up' }}
        </button>
        <p class="mt-3 mb-0 small text-body-secondary">
          Already have an account? <RouterLink to="/login">Log in</RouterLink>
        </p>
      </div>
    </form>
  </section>
</template>

<style scoped>
.signup-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 0;
}

.brand-logo {
  display: block;
  height: 60px;
  width: auto;
  margin: 0 auto;
}

.back-link {
  display: flex;
  margin-bottom: 1rem;
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

.password-rules {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  color: var(--inturn-text-muted);
}

.password-rules li.met {
  color: #198754;
}

@media (max-width: 576px) {
  .auth-card {
    padding: 1.5rem 1.25rem;
  }
}
</style>
