import { reactive } from 'vue'

// The last uploaded resume, shared by the profile and resume analysis pages:
//   resume: { fileName, pageCount, wordCount, text } from POST /api/resume
//   review: { score, checks } from POST /api/resume/analyze (the basic, rule-based review)
// The Skill Gap page also reads both for the AI deep analysis (see ResumeAnalysisView.vue).
// Kept in memory only, so it is gone after a page refresh (not saved in the database yet).
export const resumeStore = reactive({
  resume: null,
  review: null,

  clear() {
    this.resume = null
    this.review = null
  },
})
