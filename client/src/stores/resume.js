import { reactive } from 'vue'

// The PDF just uploaded in onboarding: { fileName, pageCount, wordCount, text } from POST /api/resume.
// Only used to show the file in the upload box; the AI parser turns the text into a resume
// in My Resumes, and that saved resume is what the analysis page scores.
export const resumeStore = reactive({
  resume: null,

  clear() {
    this.resume = null
  },
})
