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
