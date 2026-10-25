<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { authStore } from '../stores/auth.js'
import { resumeStore } from '../stores/resume.js'
import { analyzeResume, createResumeFromText } from '../api/resume.js'

const router = useRouter()
const ready = ref(false)
const analyzing = ref(false)
const errors = ref([])
const skills = ref([])
const review = ref(null) // { score, checks } from the server

const resume = computed(() => resumeStore.resume)
const passedCount = computed(() => review.value?.checks.filter((check) => check.passed).length ?? 0)

// The report is hidden until "View report" is clicked
const showReport = ref(false)
// Report sections in display order. A check with no category goes under "Other".
const REPORT_SECTIONS = [
  { category: 'Contact', title: 'Contact information' },
  { category: 'Structure', title: 'Structure' },
  { category: 'Other', title: 'Other' },
]
const reportGroups = computed(() => {
  const checks = review.value?.checks ?? []
  return REPORT_SECTIONS
    .map(({ category, title }) => {
      const inGroup = checks.filter((check) => (check.category ?? 'Other') === category)
      return {
        title,
        checks: inGroup,
        earned: inGroup.reduce((sum, check) => sum + check.points, 0),
        possible: inGroup.reduce((sum, check) => sum + check.maxPoints, 0),
      }
    })
    .filter((group) => group.checks.length > 0)
})

onMounted(async () => {
  if (!authStore.checked) await authStore.fetchMe()
  if (!authStore.isLoggedIn) return router.replace('/login')
  ready.value = true
  // Nothing to analyze after a refresh: the page asks for an upload instead
  if (resume.value) await runAnalysis()
})

async function runAnalysis() {
  errors.value = []
  analyzing.value = true
  try {
    const data = await analyzeResume(resume.value.text)
    skills.value = data.skills
    review.value = data.review
  } catch (e) {
    errors.value = e.errors ?? [e.message]
  } finally {
    analyzing.value = false
  }
}

// ---------------------------------------------------------------------------
// Step 2: AI deep analysis. This is the Skill Gap feature (owned by Mas);
// this page only does the basic rule-based review, then hands the resume over:
// Mas's AI turns the extracted text into a named resume, and Skill Gap opens with it
// selected (?resumeId=...), so the user does not upload the PDF again.
// ---------------------------------------------------------------------------
const preparing = ref(false)
const deepErrors = ref([])

async function startDeepAnalysis() {
  deepErrors.value = []
  preparing.value = true
  try {
    resumeStore.review = review.value
    const name = resume.value.fileName.replace(/\.pdf$/i, '')
    const { resume: saved } = await createResumeFromText({ name, text: resume.value.text })
    router.push({ path: '/skill-gap', query: { resumeId: saved._id } })
  } catch (e) {
    deepErrors.value = e.errors ?? [e.message]
  } finally {
    preparing.value = false
  }
}
</script>

<template>
  <section v-if="ready" class="analysis-page">
    <header class="page-header">
      <div>
        <h1 class="header-title">Resume Analysis</h1>
        <p class="header-subtitle">
          {{ resume ? resume.fileName : 'See how your resume scores and what to improve.' }}
        </p>
      </div>
      <RouterLink to="/profile" class="btn-outline-inturn">Back to profile</RouterLink>
    </header>

    <!-- Opened directly or after a refresh: the uploaded resume is no longer in memory -->
    <article v-if="!resume" class="panel text-center">
      <p class="mb-3">Upload your resume on your profile first, then analyze it here.</p>
      <RouterLink to="/profile" class="btn-primary-inturn">Go to my profile</RouterLink>
    </article>

    <template v-else>
      <div v-if="errors.length" class="alert alert-danger py-2" role="alert">
        <div v-for="error in errors" :key="error">{{ error }}</div>
      </div>

      <article v-if="analyzing" class="panel text-center" role="status">
        <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
        Analyzing your resume...
      </article>

      <template v-else-if="review">
        <article class="panel score-panel">
          <div class="score" aria-label="Resume score">
            <span class="score-value">{{ review.score ?? '–' }}</span>
            <span class="score-max">/ 100</span>
          </div>
          <div class="score-detail">
            <div class="progress" role="progressbar" :aria-valuenow="review.score ?? 0" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-bar" :style="{ width: `${review.score ?? 0}%` }"></div>
            </div>
            <p class="muted mb-0">
              {{ review.checks.length ? `${passedCount} of ${review.checks.length} checks passed` : 'No checks to show yet.' }}
            </p>
          </div>
          <button
            v-if="review.checks.length"
            type="button"
            class="btn-outline-inturn"
            aria-controls="resume-report"
            :aria-expanded="showReport"
            @click="showReport = !showReport"
          >
            {{ showReport ? 'Hide report' : 'View report' }}
          </button>
        </article>

        <!-- The report: checks grouped by category (Contact information, Structure) -->
        <article v-if="showReport" id="resume-report" class="panel">
          <section v-for="group in reportGroups" :key="group.title" class="report-group">
            <div class="group-head">
              <h2 class="section-title mb-0">{{ group.title }}</h2>
              <span class="muted">{{ group.earned }} / {{ group.possible }}</span>
            </div>
            <ul class="check-list">
              <li v-for="check in group.checks" :key="check.label" class="check" :class="{ failed: !check.passed }">
                <span class="check-icon" aria-hidden="true">{{ check.passed ? '✓' : '!' }}</span>
                <div class="check-body">
                  <div class="check-head">
                    <span class="check-label">{{ check.label }}</span>
                    <span class="muted">{{ check.points }} / {{ check.maxPoints }}</span>
                  </div>
                  <p v-if="!check.passed && check.suggestion" class="check-suggestion mb-0">{{ check.suggestion }}</p>
                </div>
              </li>
            </ul>
          </section>
        </article>

        <!-- Step 2: AI deep analysis against a job posting (Skill Gap feature) -->
        <article class="panel deep-panel">
          <div>
            <h2 class="section-title mb-1">AI deep analysis</h2>
            <p class="muted mb-0">Compare this resume with a job posting to find missing skills and how to tailor it.</p>
          </div>
          <button type="button" class="btn-primary-inturn" :disabled="preparing" @click="startDeepAnalysis">
            <span v-if="preparing" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
            {{ preparing ? 'Reading your resume...' : 'AI deep analysis' }}
          </button>
        </article>
        <div v-if="deepErrors.length" class="alert alert-danger py-2" role="alert">
          <div v-for="error in deepErrors" :key="error">{{ error }}</div>
        </div>

        <!-- TODO(skills step): show "Skills found" here once extractSkills is written -->
      </template>
    </template>
  </section>
</template>

<style scoped>
.analysis-page {
  max-width: 760px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 8px;
}

.header-title {
  font-size: 1.15rem;
  font-weight: 700;
  margin-bottom: 0.15rem;
}

.header-subtitle {
  font-size: 0.8rem;
  margin-bottom: 0;
  overflow-wrap: anywhere;
}

.panel {
  padding: 1.5rem;
  margin-bottom: 1.25rem;
  background: #f3f3f3;
  border-radius: 16px;
}

.muted {
  color: #6c757d;
  font-size: 0.9rem;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.score-panel {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.score {
  flex-shrink: 0;
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.score-value {
  font-size: 2.75rem;
  font-weight: 700;
  color: #3c70b3;
  line-height: 1;
}

.score-max {
  color: #6c757d;
}

.score-detail {
  flex: 1;
  min-width: 0;
}

.deep-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

.progress {
  height: 10px;
  margin-bottom: 0.5rem;
  background: #dde7f8;
}

.progress-bar {
  background: #4e8be6;
}

.check-list,
.skill-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.report-group + .report-group {
  margin-top: 1.5rem;
}

.group-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #dde7f8;
}

.check {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid #e2e2e2;
}

.check:last-child {
  border-bottom: none;
}

.check-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 700;
  background: #d1e7dd;
  color: #0f5132;
}

.check.failed .check-icon {
  background: #fff3cd;
  color: #664d03;
}

.check-body {
  flex: 1;
  min-width: 0;
}

.check-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.check-label {
  font-weight: 600;
}

.check-suggestion {
  margin-top: 0.25rem;
  font-size: 0.9rem;
}

.skill-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.skill {
  padding: 0.3rem 0.85rem;
  background: #fff;
  color: #3c70b3;
  border: 1px solid #c9d9f3;
  border-radius: 999px;
  font-size: 0.85rem;
}

.skill.evidenced {
  background: #e3ecfb;
  border-color: #4e8be6;
}

.legend {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.75rem;
  font-size: 0.8rem;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #e3ecfb;
  border: 1px solid #4e8be6;
}

.btn-primary-inturn,
.btn-outline-inturn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.25rem;
  border-radius: 10px;
  white-space: nowrap;
  text-decoration: none;
}

.btn-primary-inturn {
  background: #4e8be6;
  color: #fff;
  border: none;
}

.btn-primary-inturn:hover {
  background: #3c70b3;
  color: #fff;
}

.btn-outline-inturn {
  background: #fff;
  color: #4e8be6;
  border: 1px solid #4e8be6;
}

.btn-outline-inturn:hover {
  background: #e3ecfb;
  color: #3c70b3;
}

@media (max-width: 576px) {
  .page-header,
  .score-panel,
  .deep-panel {
    flex-direction: column;
    align-items: flex-start;
  }

  .score-detail {
    width: 100%;
  }

  .panel {
    padding: 1.25rem;
  }
}
</style>
