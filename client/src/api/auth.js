import { request } from './http.js'

export function signup({ name, email, password, confirmPassword }) {
  return request('/auth/signup', { method: 'POST', body: { name, email, password, confirmPassword } })
}

export function login({ email, password, rememberMe }) {
  return request('/auth/login', { method: 'POST', body: { email, password, rememberMe } })
}

export function logout() {
  return request('/auth/logout', { method: 'POST' })
}

export function getMe() {
  return request('/auth/me')
}

// Both re-check the current password on the server.
export function changeEmail({ email, currentPassword }) {
  return request('/auth/email', { method: 'PUT', body: { email, currentPassword } })
}

export function changePassword({ currentPassword, password, confirmPassword }) {
  return request('/auth/password', { method: 'PUT', body: { currentPassword, password, confirmPassword } })
}
