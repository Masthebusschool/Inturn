<script setup>
import { computed, ref, onMounted } from 'vue';
import { formatDate } from '../../helpers/apptrackingboard/KanbanViewHelper';

const props = defineProps({ app: Object, collapsed: Boolean });
const emit = defineEmits(['tailor-resume', 'view-intel', 'toggle']);

// which date to show depends on the column e.g. interviewAt, AppliedAt 
const dateLabel = computed(() => {
  const app = props.app;
  if (app.status === 'Interview') {
    return app.interviewAt ? 'Interview ' + formatDate(app.interviewAt) : 'No interview date';
  }
  if (app.status === 'Applied' && app.appliedDate) return 'Applied ' + formatDate(app.appliedDate);
  return 'Due ' + formatDate(app.expiryDate);
});

// skills matched as a percentage (will be 0 if the job lists no skills)
const matchPercent = computed(() => {
  if (!props.app.total) return 0;
  return (props.app.matched / props.app.total) * 100;
});

// whether the missing skills list is open (picks the arrow icon)
const missingOpen = ref(false);
const missingList = ref(null);
const details = ref(null);

// tell the board when the details open/close, so it remembers the state after a column move
// (target check because the missing skills list's events bubble up through the details)
function onDetailsToggle (event) { if (event.target === details.value) emit('toggle'); }

// bootstrap fires these when the list starts opening/closing
// mount the event so v-on would not read the dots in 'show.bs.collapse' as modifiers
onMounted(() => {
  missingList.value.addEventListener('show.bs.collapse', () => { missingOpen.value = true; });
  missingList.value.addEventListener('hide.bs.collapse', () => { missingOpen.value = false; });
  details.value.addEventListener('show.bs.collapse', onDetailsToggle);
  details.value.addEventListener('hide.bs.collapse', onDetailsToggle);
  if (!props.collapsed) details.value.classList.add('show');
});
</script>

<template>
  <div class="card-muted-inturn" :class="'status-' + app.status.toLowerCase()">
    <div class="clearfix mb-2">
      <span class="menu-space float-end"></span>
      <p class="card-title fw-semibold mb-0">
        {{ app.title }}
        <span v-if="app.isFavourite" class="star ms-1">&#9733;</span>
      </p>
    </div>

    <div class="d-flex flex-wrap justify-content-between column-gap-2 small text-secondary mt-2">
      <span>{{ app.company }}</span>
      <span class="text-nowrap">{{ dateLabel }}</span>
    </div>

    <div class="d-flex flex-wrap justify-content-between column-gap-2 small text-secondary mt-2">
      <span>Checklist:</span>
      <span class="text-nowrap">{{ app.prep }} Prep</span>
    </div>
    <!-- pointerdown.stop so clicking the link doesn't start a card drag -->
    <a
      v-if="app.jobDetailsUrl"
      :href="app.jobDetailsUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="job-link d-flex justify-content-between align-items-center column-gap-2 small mt-2 text-decoration-none"
      title="Open the job posting in a new tab"
      v-on:pointerdown.stop
    >
      <span class="text-secondary">Job Posting:</span>
      <span class="job-link-action text-nowrap">
        View <i class="bi bi-box-arrow-up-right ms-1"></i>
      </span>
    </a>
    <hr class="my-2" />
    <!-- opens or closes the rest of the card -->
    <button
      type="button"
      class="skills-toggle btn btn-link btn-sm p-0 w-100 d-flex justify-content-between align-items-center text-decoration-none"
      data-bs-toggle="collapse"
      :data-bs-target="'#details-'+app._id"
      v-on:pointerdown.stop
    >
      <small class="text-decoration-underline">{{ collapsed ? 'Show details' : 'Hide details' }}</small>
      <i class="bi small" :class="collapsed ? 'bi-chevron-down' : 'bi-chevron-up'"></i>
    </button>

    <!-- the details, starts open unless the board says it's collapsed (set in onMounted) -->
    <div ref="details" class="collapse" :id="'details-' + app._id">
    <div class="pt-2">

    <div class="progress">
      <!-- if the job lists no skills, the bar stays empty (avoids dividing by 0) -->
      <div class="progress-bar" :style="{ width: matchPercent + '%' }"></div>
    </div>
    <small class="d-block mt-1 text-secondary">{{ app.matched }}/{{ app.total }} Skills Matched</small>
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

    <!-- only while the card is still in Saved, then allow user to tailor their resume -->
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

    <!-- only in Interview, when there is intel for this job -->
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
    </div>

    <slot>
      <!-- Insert Dropdown Button to shift to other columns (For Mobile ONLY) -->
    </slot>
  </div>
</template>

<style scoped>
  .menu-space {
      width: 3.5rem;
      height: 2.25rem;
  }

  .card-title {
      color: var(--inturn-text);
      line-height: 1.35;
  }

  .star { /* for the favourite colour */
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

  .job-link-action {
      color: var(--inturn-primary);
      font-weight: 500;
  }

  .job-link:hover .job-link-action {
      text-decoration: underline;
  }

  .skills-toggle {
      color: var(--inturn-text-muted);
  }

  .skills-toggle:hover {
      color: var(--inturn-primary);
  }
</style>