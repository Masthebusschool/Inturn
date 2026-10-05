// AI service: the team will choose Gemini (GEMINI_API_KEY) or Groq (GROQ_API_KEY).
// Keys are read from process.env inside the functions, never at import time.
// Keys stay server-side only and are never sent to the client.

export async function analyzeSkillGap(profile, job) {
  throw new Error('aiService.analyzeSkillGap not implemented yet');
}

export async function generateInterviewQuestions(job) {
  throw new Error('aiService.generateInterviewQuestions not implemented yet');
}

export async function evaluateInterviewAnswer({ question, answer, job }) {
  throw new Error('aiService.evaluateInterviewAnswer not implemented yet');
}
