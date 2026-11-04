<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { authStore } from '../stores/auth.js'
import { reviewResume } from '../api/resume.js'

// The resume to analyze comes from My Resumes: /resumes/:id/analysis
const props = defineProps({ id: { type: String, required: true } })

const router = useRouter()
const ready = ref(false)
const analyzing = ref(false)
const errors = ref([])
const resume = ref(null) // { id, name, updatedAt }
const review = ref(null) // { score, checks } from the server

const passedCount = computed(() => review.value?.checks.filter((check) => check.passed).length ?? 0)

// The report is hidden until "View report" is clicked
const showReport = ref(false)
// Report sections in display order. A check with no category goes under "Other".
const REPORT_SECTIONS = [
  { category: 'Contact', title: 'Contact information' },
  { category: 'Structure', title: 'Structure' },
  { category: 'Content', title: 'Content' },
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
  await runAnalysis()
})

// Scores the saved resume, so editing it and coming back shows the new score
async function runAnalysis() {
  errors.value = []
  analyzing.value = true
  try {
    const data = await reviewResume(props.id)
    resume.value = data.resume
    review.value = data.review
  } catch (e) {
    errors.value = e.errors ?? [e.message]
  } finally {
    analyzing.value = false
  }
}

// ---------------------------------------------------------------------------
// Step 2: AI deep analysis. This is the Skill Gap feature (owned by Mas);
// this page only does the basic rule-based review, then opens Skill Gap with
// the same resume selected (?resumeId=...), so nothing is uploaded or parsed again.
// ---------------------------------------------------------------------------
function startDeepAnalysis() {
  router.push({ path: '/skill-gap', query: { resumeId: props.id } })
}
</script>

<template>
  <section v-if="ready" class="analysis-page">
    <header class="page-header">
      <div>
        <h1 class="header-title">Resume Analysis</h1>
        <p class="header-subtitle">
          {{ resume ? resume.name : 'See how your resume scores and what to improve.' }}
        </p>
      </div>
      <div class="header-actions">
        <RouterLink v-if="resume" :to="`/resumes/${id}`" class="btn-secondary-inturn">Edit resume</RouterLink>
        <RouterLink to="/resumes" class="btn-neutral-inturn">Back to My Resumes</RouterLink>
      </div>
    </header>

    <div v-if="errors.length" class="alert alert-danger py-2" role="alert">
      <div v-for="error in errors" :key="error">{{ error }}</div>
    </div>

    <article v-if="analyzing" class="card-inturn panel text-center" role="status">
      <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
      Analyzing your resume...
    </article>

    <template v-else-if="review">
      <article class="card-inturn panel score-panel">
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
          class="btn-secondary-inturn"
          aria-controls="resume-report"
          :aria-expanded="showReport"
          @click="showReport = !showReport"
        >
          {{ showReport ? 'Hide report' : 'View report' }}
        </button>
      </article>

      <!-- The report: checks grouped by category (Contact information, Structure, Content) -->
      <article v-if="showReport" id="resume-report" class="card-inturn panel">
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
      <article class="card-inturn panel deep-panel">
        <div>
          <h2 class="section-title mb-1">AI deep analysis</h2>
          <p class="muted mb-0">Compare this resume with an internship posting to find missing skills and how to tailor it.</p>
        </div>
        <button type="button" class="btn-primary-inturn" @click="startDeepAnalysis">AI deep analysis</button>
      </article>
    </template>
  </section>
</template>

<style scoped>
.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.header-subtitle {
  overflow-wrap: anywhere;
}

.panel {
  margin-bottom: 1.25rem;
}

.muted {
  color: var(--inturn-text-muted);
  font-size: 0.9rem;
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
  color: var(--inturn-primary-hover);
  line-height: 1;
}

.score-max {
  color: var(--inturn-text-muted);
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
  background: var(--inturn-primary-soft);
}

.progress-bar {
  background: var(--inturn-primary);
}

.check-list {
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
  border-bottom: 2px solid var(--inturn-primary-soft);
}

.check {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--inturn-border);
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

@media (max-width: 576px) {
  .score-panel,
  .deep-panel {
    flex-direction: column;
    align-items: flex-start;
  }

  .score-detail {
    width: 100%;
  }
}
</style>
