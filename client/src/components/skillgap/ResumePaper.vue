<script setup>
defineProps({
  draft: { type: Object, required: true },
  profile: { type: Object, default: null }, // { contact: {fullName,phone,email,linkedin,github,portfolio}, education }
  print: { type: Boolean, default: false },
})
const dates = (e) => [e.startDate, e.endDate].filter(Boolean).join(' – ')
const contactLine = (c) => [c?.phone, c?.email, c?.linkedin, c?.github, c?.portfolio].filter(Boolean).join(' · ')
</script>

<template>
  <article class="sg-paper" :class="print ? 'sg-print-area' : 'sg-screen-paper'">
    <header v-if="profile?.contact?.fullName || profile?.contact?.email" class="sg-paper-head">
      <div class="sg-paper-name">{{ profile.contact.fullName }}</div>
      <div v-if="contactLine(profile.contact)" class="sg-paper-contact">{{ contactLine(profile.contact) }}</div>
    </header>
    <p v-if="draft.summary" class="sg-paper-summary">{{ draft.summary }}</p>
    <template v-if="profile?.education?.length">
      <h3 class="sg-paper-h">Education</h3>
      <div v-for="(e, i) in profile.education" :key="i" class="mb-2">
        <div class="fw-semibold">{{ e.school }}<span v-if="dates(e)" class="fw-normal text-secondary"> · {{ dates(e) }}</span></div>
        <div v-if="e.degree || e.field">{{ [e.degree, e.field].filter(Boolean).join(', ') }}</div>
      </div>
    </template>
    <template v-if="draft.projects?.length">
      <h3 class="sg-paper-h">Personal Projects</h3>
      <div v-for="(p, i) in draft.projects" :key="i" class="mb-3">
        <div class="fw-semibold">{{ p.name }}</div>
        <ul class="mb-0 ps-3"><li v-for="(b, j) in p.bullets" :key="j">{{ b }}</li></ul>
      </div>
    </template>
    <template v-if="draft.experience?.length">
      <h3 class="sg-paper-h">Professional Experience</h3>
      <div v-for="(e, i) in draft.experience" :key="i" class="mb-3">
        <div class="fw-semibold">{{ e.title }}<span v-if="e.company" class="fw-normal"> — {{ e.company }}</span></div>
        <ul class="mb-0 ps-3"><li v-for="(b, j) in e.bullets" :key="j">{{ b }}</li></ul>
      </div>
    </template>
    <template v-if="draft.skills?.length">
      <h3 class="sg-paper-h">Skills</h3>
      <p class="mb-3">{{ draft.skills.join(' · ') }}</p>
    </template>
  </article>
</template>

<style scoped>
.sg-paper { background: #fff; color: #212529; padding: 1.75rem; font-size: 0.9rem; line-height: 1.5; border: 1px solid var(--bs-border-color); border-radius: var(--bs-border-radius); box-shadow: var(--bs-box-shadow-sm); }
.sg-print-area { display: none; }
.sg-screen-paper { max-width: 650px; margin: 0 auto; line-height: 1.6; }
.sg-paper-head { border-bottom: 2px solid #212529; padding-bottom: 0.5rem; margin-bottom: 1rem; }
.sg-paper-name { font-size: 1.4rem; font-weight: 700; line-height: 1.2; }
.sg-paper-contact { color: #495057; font-size: 0.85rem; }
.sg-paper-summary { margin-bottom: 1rem; }
.sg-paper-h { font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; border-bottom: 1px solid #dee2e6; padding-bottom: 0.2rem; margin: 1.1rem 0 0.6rem; }
</style>

<style>
@media print {
  body:has(> .sg-print-area) > :not(.sg-print-area) { display: none !important; }
  .sg-print-area { display: block !important; box-shadow: none !important; border: 0 !important; padding: 0; }
}
</style>
