<script setup>
import { ref, reactive } from 'vue'
import { authStore } from '../stores/auth.js'
import { isValidEmail, PASSWORD_RULES } from '../utils/validators.js'

const form = reactive({ name: '', email: '', password: '', confirmPassword: '' })
const errors = ref([])
const submitting = ref(false)
const createdUser = ref(null)

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
    createdUser.value = await authStore.signup({ ...form, name: form.name.trim(), email: form.email.trim() })
    form.password = ''
    form.confirmPassword = ''
  } catch (err) {
    errors.value = err.errors ?? [err.message]
  } finally {
    submitting.value = false
  }
}

</script>

<template>
  <section class="signup-page">
    <img src="../assets/logogogo.jpg" class="brand-logo">

    <div v-if="createdUser" class="signup-card text-center">
      <h2 class="welcome">Account created</h2>
      <p class="subtitle mb-1">{{ createdUser.name }}</p>
      <p class="subtitle">{{ createdUser.email }}</p>
      <p class="small text-body-secondary">Log in to complete your profile.</p>
      <!-- The email goes in history state (not the URL) so the login form can prefill it -->
      <RouterLink :to="{ path: '/login', state: { email: createdUser.email } }" class="btn-primary-inturn">Log in</RouterLink>
    </div>

    <form v-else class="signup-card" novalidate @submit.prevent="handleSignup">
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
          class="form-control input-inturn"
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
          class="form-control input-inturn"
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
          class="form-control input-inturn"
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
          class="form-control input-inturn"
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
.brand-logo{
  height:120px;
  width: auto;
  padding:1rem 0;
}

.signup-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 0;
}

.brand {
  font-size: 3rem;
  font-weight: 400;
  margin-bottom: 2rem;
}

.signup-card {
  width: 100%;
  max-width: 520px;
  padding: 2rem 2.75rem;
  background: #f3f3f3;
  border: 1px solid #4e8be6;
  border-radius: 16px;
}

.welcome {
  font-size: 1.75rem;
  font-weight: 900;
  margin-bottom: 1.25rem;
}

.subtitle {
  font-size: 0.85rem;
  color: #6c757d;
  margin-bottom: 1.5rem;
}

.input-inturn {
  border: 1px solid #222;
  border-radius: 12px;
  padding: 0.65rem 0.9rem;
}

.password-rules {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  color: #6c757d;
}

.password-rules li.met {
  color: #198754;
}

.btn-primary-inturn {
  background: #4e8be6;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 0.5rem 2.5rem;
  font-size: 1.1rem;
}

.btn-primary-inturn:hover:not(:disabled) {
  background: #3c70b3;
}

.btn-primary-inturn:disabled {
  opacity: 0.7;
}

/* The "Log in" RouterLink on the Account created card, styled as the button */
a.btn-primary-inturn {
  display: inline-block;
  text-decoration: none;
}

a.btn-primary-inturn:hover {
  color: #fff;
}

@media (max-width: 576px) {
  .signup-card {
    padding: 1.5rem 1.25rem;
  }
}
</style>
