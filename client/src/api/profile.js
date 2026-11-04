import { request } from './http.js'

export function getProfile() {
  return request('/profile')
}

// Used by onboarding and the edit profile page. name is optional (only updated when sent).
export function updateProfile({ name, educationLevel, institution, fieldOfStudy, targetIndustries }) {
  return request('/profile', {
    method: 'PUT',
    body: { name, educationLevel, institution, fieldOfStudy, targetIndustries },
  })
}

export function getActivity() {
  return request('/profile/activity')
}

// Permanently deletes the account; the server checks the typed email.
export function deleteAccount(confirmEmail) {
  return request('/profile', { method: 'DELETE', body: { confirmEmail } })
}
