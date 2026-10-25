import { request } from './http.js'

// Sends the PDF in the "resume" form field; the server replies with its text.
export function uploadResume(file) {
  const form = new FormData()
  form.append('resume', file)
  return request('/resume', { method: 'POST', body: form })
}

// Sends the extracted text back for scoring; replies with { skills, review }.
export function analyzeResume(text) {
  return request('/resume/analyze', { method: 'POST', body: { text } })
}
