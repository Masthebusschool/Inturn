import { request } from './http.js'

// Sends the PDF in the "resume" form field; the server replies with its text.
export function uploadResume(file) {
  const form = new FormData()
  form.append('resume', file)
  return request('/resume', { method: 'POST', body: form })
}

// Scores one resume from My Resumes; replies with { resume: { id, name, updatedAt }, review }.
export function reviewResume(resumeId) {
  return request(`/resume/${resumeId}/review`)
}

// "AI deep analysis": the Skill Gap feature's AI turns the extracted text into a named resume
// (POST /api/resumes/from-text), so the PDF does not have to be uploaded again. Replies with { resume }.
export function createResumeFromText({ name, text }) {
  return request('/resumes/from-text', { method: 'POST', body: { name, text } })
}

// The user's primary (profile) resume: { resume } or { resume: null }.
export function getPrimaryResume() {
  return request('/resumes/primary')
}

// Saves any subset of { skills, experience, projects }; creates "My Profile" if there is no primary yet.
export function updatePrimaryResume(fields) {
  return request('/resumes/primary', { method: 'PATCH', body: fields })
}
