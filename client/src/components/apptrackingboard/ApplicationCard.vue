<script setup>
import { computed, ref, onMounted } from 'vue';
import { formatDate } from '../../helpers/apptrackingboard/KanbanViewHelper';
import { BAND_META, rawBand } from '../../lib/skillgap.js';

// collapsed shows only the title, company, date and checklist, the page keeps track of it
const props = defineProps({ app: Object, collapsed: Boolean });
const emit = defineEmits(['tailor-resume', 'view-intel', 'toggle']);

// which date to show depends on the column
const dateLabel = computed(() => {
  const app = props.app;
  if (app.status === 'Interview') {
    return app.interviewAt ? 'Interview ' + formatDate(app.interviewAt) : 'No interview date';
  }
  if (app.status === 'Applied' && app.appliedDate) return 'Applied ' + formatDate(app.appliedDate);
  return 'Due ' + formatDate(app.expiryDate);
});

// a linked Skill Gap analysis score beats the matched/total heuristic
const hasScore = computed(() => props.app.skillGapScore != null);
const scoreCaption = computed(() => {
  const score = props.app.skillGapScore;
  const band = BAND_META[props.app.skillGapBand] ?? BAND_META[rawBand(score)];
  return `${score}% · ${band.label} (Skill Gap analysis)`;
});

// skills matched as a percentage (0 if the job lists no skills)
const matchPercent = computed(() => {
  if (hasScore.value) return props.app.skillGapScore;
  if (!props.app.total) return 0;
  return (props.app.matched / props.app.total) * 100;
});

// whether the missing skills list is open (picks the arrow icon)
const missingOpen = ref(false);
const missingList = ref(null);

// bootstrap fires these when the list starts opening/closing
// (added here because v-on would read the dots in 'show.bs.collapse' as modifiers)
onMounted(() => {
  missingList.value.addEventListener('show.bs.collapse', () => { missingOpen.value = true; });
  missingList.value.addEventListener('hide.bs.collapse', () => { missingOpen.value = false; });
});
</script>

<template>
  <!-- background colour from the status, e.g. 'Interview' -> status-interview in main.css -->
  <div class="card-muted-inturn" :class="'status-' + app.status.toLowerCase()">
    <!-- title + favourite star (clearfix stops a short title's row ending above the float) -->
    <div class="clearfix mb-2">
      <!-- invisible block where the 3 dot menu sits, the title wraps around it instead of under it -->
      <span class="menu-space float-end"></span>
      <p class="card-title fw-semibold mb-0">
        {{ app.title }}
        <span v-if="app.isFavourite" class="star ms-1">&#9733;</span>
      </p>
    </div>

    <!-- flex-wrap drops the date onto its own line when the card is too narrow -->
    <div class="d-flex flex-wrap justify-content-between column-gap-2 small text-secondary mt-2">
      <span>{{ app.company }}</span>
      <span class="text-nowrap">{{ dateLabel }}</span>
    </div>

    <!-- same wrap as the row above -->
    <div class="d-flex flex-wrap justify-content-between column-gap-2 small text-secondary mt-2">
      <span>Checklist:</span>
      <span class="text-nowrap">{{ app.prep }} Prep</span>
    </div>

    <hr class="my-2" />

    <!-- opens or closes the rest of the card -->
    <button
      type="button"
      class="skills-toggle btn btn-link btn-sm p-0 w-100 d-flex justify-content-between align-items-center text-decoration-none"
      v-on:pointerdown.stop
      v-on:click="emit('toggle')"
    >
      <small class="text-decoration-underline">{{ collapsed ? 'Show details' : 'Hide details' }}</small>
      <i class="bi small" :class="collapsed ? 'bi-chevron-down' : 'bi-chevron-up'"></i>
    </button>

    <!-- the details, v-show (not v-if) so missingList still exists for onMounted -->
    <!-- mt-2 so the progress bar isn't touching the toggle -->
    <div v-show="!collapsed" class="mt-2">

    <div class="progress">
      <!-- if the job lists no skills, the bar stays empty (avoids dividing by 0) -->
      <div class="progress-bar" :style="{ width: matchPercent + '%' }"></div>
    </div>
    <small v-if="hasScore" class="d-block mt-1 text-secondary">{{ scoreCaption }}</small>
    <small v-else class="d-block mt-1 text-secondary">{{ app.matched }}/{{ app.total }} Skills Matched</small>

    <!-- full width row under the count that opens the missing skills, hidden when nothing is missing -->
    <button
      v-if="app.missing?.length"
      type="button"
      class="skills-toggle btn btn-link btn-sm p-0 mt-2 w-100 d-flex justify-content-between align-items-center text-decoration-none"
      data-bs-toggle="collapse"
      :data-bs-target="'#missing-' + app._id"
      v-on:pointerdown.stop
    >
      <small class="text-decoration-underline">View Missing Skills</small>
      <i class="bi small" :class="missingOpen ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
    </button>

    <!-- display missing skills if any -->
    <div ref="missingList" class="collapse" :id="'missing-' + app._id">
      <div class="d-flex flex-wrap gap-1 my-2">
        <span v-for="skill in app.missing" :key="skill" class="tag-inturn">
          {{ skill }}
        </span>
      </div>
    </div>

    <!-- only while the card is still in Saved: this is a pre-decision tool, not an ongoing one -->
    <button
      v-if="app.status === 'Saved'"
      type="button"
      class="btn-secondary-inturn btn-sm-inturn w-100 mt-2"
      v-on:pointerdown.stop
      v-on:click="emit('tailor-resume', app)"
    >
      <span v-if="app.skillGapScore != null" class="badge text-bg-light border me-1">{{ app.skillGapScore }}</span>
      Tailor Resume
    </button>

    <!-- only in Interview, when there is intel for this job (text-wrap so it fits narrow cards) -->
    <button
      v-if="app.status === 'Interview' && app.intelCount > 0"
      type="button"
      class="btn-secondary-inturn btn-sm-inturn w-100 mt-2 text-wrap"
      v-on:pointerdown.stop
      v-on:click="emit('view-intel', app)"
    >
      View Intel ({{ app.intelCount }})
    </button>
    <!-- Interview with no matching intel -->
    <small v-else-if="app.status === 'Interview'" class="d-block text-center text-secondary mt-2">No Intel Found</small>
    </div>

    <slot>
      <!-- Insert Dropdown Button to shift to other columns -->
    </slot>
  </div>
</template>

<style scoped>
  /* about the size of the 3 dot button plus a gap, so the title never touches it */
  .menu-space {
      width: 3.5rem;
      height: 2.25rem;
  }

  .card-title {
      color: var(--inturn-text);
      line-height: 1.35;
  }

  .star {
     color: #f5b301; 
  }

  .progress {
      height: 10px;
      border: 1px solid rgb(184, 213, 255);
      border-radius: var(--r-pill);
      background: var(--inturn-surface);
  }

  .progress-bar {
      border-radius: var(--r-pill);
      background: var(--inturn-primary);
  }

  /* own colour instead of text-secondary, which is !important and would block the hover */
  .skills-toggle {
      color: var(--inturn-text-muted);
  }

  .skills-toggle:hover {
      color: var(--inturn-primary);
  }
</style>