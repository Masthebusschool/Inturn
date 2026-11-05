<script setup>
import { contactLine } from '../../utils/contact.js'
defineProps({
  form: { type: Object, required: true }, // { contact, summary, skills, experience, projects, education } — see ResumeEditorView's previewData
})

const dateRange = (e) => [e.startDate, e.endDate].filter(Boolean).join(' – ')
</script>

<template>
  <article class="rp-paper">
    <header class="rp-head">
      <div class="rp-name">{{ form.contact.fullName || 'Your name' }}</div>
      <div v-if="contactLine(form.contact)" class="rp-contact">{{ contactLine(form.contact) }}</div>
    </header>

    <p v-if="form.summary" class="rp-summary">{{ form.summary }}</p>

    <template v-if="form.education.length">
      <h3 class="rp-h">Education</h3>
      <div v-for="(e, i) in form.education" :key="i" class="mb-3">
        <div class="d-flex justify-content-between gap-2">
          <span class="fw-semibold">{{ e.school }}</span>
          <span v-if="dateRange(e)" class="text-body-secondary small flex-shrink-0">{{ dateRange(e) }}</span>
        </div>
        <div v-if="e.degree || e.field || e.grade" class="fst-italic small">
          {{ [e.degree, e.field].filter(Boolean).join(', ') }}<template v-if="e.grade"> | {{ e.grade }}</template>
        </div>
        <ul v-if="e.bullets.length" class="mb-0 ps-3 small"><li v-for="(b, j) in e.bullets" :key="j">{{ b }}</li></ul>
      </div>
    </template>

    <template v-if="form.projects.length">
      <h3 class="rp-h">Personal Projects</h3>
      <div v-for="(p, i) in form.projects" :key="i" class="mb-3">
        <div class="d-flex justify-content-between gap-2">
          <span class="fw-semibold">{{ p.name }}</span>
          <span v-if="dateRange(p)" class="text-body-secondary small flex-shrink-0">{{ dateRange(p) }}</span>
        </div>
        <div v-if="p.skills.length" class="fst-italic small">({{ p.skills.join(', ') }})</div>
        <ul v-if="p.bullets.length" class="mb-0 ps-3 small"><li v-for="(b, j) in p.bullets" :key="j">{{ b }}</li></ul>
      </div>
    </template>

    <template v-if="form.experience.length">
      <h3 class="rp-h">Professional Experience</h3>
      <div v-for="(x, i) in form.experience" :key="i" class="mb-3">
        <div class="d-flex justify-content-between gap-2">
          <span class="fw-semibold">{{ x.title }}<template v-if="x.company"> — {{ x.company }}</template><template v-if="x.location"> · {{ x.location }}</template></span>
          <span v-if="dateRange(x)" class="text-body-secondary small flex-shrink-0">{{ dateRange(x) }}</span>
        </div>
        <ul v-if="x.bullets.length" class="mb-0 ps-3 small"><li v-for="(b, j) in x.bullets" :key="j">{{ b }}</li></ul>
      </div>
    </template>

    <template v-if="form.skills.length">
      <h3 class="rp-h">Skills</h3>
      <p class="mb-0 small">{{ form.skills.join(' · ') }}</p>
    </template>
  </article>
</template>

<style scoped>
.rp-paper { background: #fff; color: #212529; padding: 1.75rem; font-size: 0.9rem; line-height: 1.5; border: 1px solid var(--bs-border-color); border-radius: var(--r-sm); box-shadow: var(--bs-box-shadow-sm); }
.rp-head { text-align: center; border-bottom: 2px solid #212529; padding-bottom: 0.6rem; margin-bottom: 1rem; }
.rp-name { font-size: 1.5rem; font-weight: 700; letter-spacing: 0.02em; }
.rp-contact { color: #495057; font-size: 0.8rem; margin-top: 0.2rem; }
.rp-summary { margin-bottom: 1rem; }
.rp-h { font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; border-bottom: 1px solid #dee2e6; padding-bottom: 0.2rem; margin: 1.1rem 0 0.6rem; }
</style>
