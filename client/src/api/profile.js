import { request } from './http.js'

export function getProfile() {
  return request('/profile')
}

// Used by onboarding and edit profile.
export function updateProfile({ educationLevel, institution, fieldOfStudy, skills, targetIndustries }) {
  return request('/profile', {
    method: 'PUT',
    body: { educationLevel, institution, fieldOfStudy, skills, targetIndustries },
  })
}

export function getActivity() {
  return request('/profile/activity')
}

// Permanently deletes the account; the server checks the typed email.
export function deleteAccount(confirmEmail) {
  return request('/profile', { method: 'DELETE', body: { confirmEmail } })
}
