<script setup>
import { computed } from 'vue';
import { formatDate } from '../../helpers/apptrackingboard/KanbanViewHelper';

const props = defineProps({ app: Object });
const emit = defineEmits(['tailor-resume']);

// which date to show depends on the column
const dateLabel = computed(() => {
  const app = props.app;
  if (app.status === 'Interview') {
    return app.interviewAt ? 'Interview ' + formatDate(app.interviewAt) : 'No interview date';
  }
  if (app.status === 'Applied' && app.appliedDate) return 'Applied ' + formatDate(app.appliedDate);
  return 'Due ' + formatDate(app.expiryDate);
});

// skills matched as a percentage (0 if the job lists no skills)
const matchPercent = computed(() => {
  if (!props.app.total) return 0;
  return (props.app.matched / props.app.total) * 100;
});
</script>

<template>
  <div class="app-card p-3">
    <!-- title + favourite star (pe-5 leaves room for the 3 dot menu) -->
    <div class="d-flex align-items-start gap-2 pe-5 mb-2">
      <p class="card-title fw-semibold mb-0">{{ app.title }}</p>
      <span v-if="app.isFavourite" class="star">&#9733;</span>
    </div>

    <div class="d-flex justify-content-between small text-secondary mt-2">
      <span>{{ app.company }}</span>
      <span>{{ dateLabel }}</span>
    </div>

    <div class="d-flex justify-content-between small text-secondary mt-2">
      <span>Checklist:</span>
      <span>{{ app.prep }} Prep</span>
    </div>
    
    <hr class="my-2" />

    <div class="progress">
      <!-- if the job lists no skills, the bar stays empty (avoids dividing by 0) -->
      <div class="progress-bar" :style="{ width: matchPercent + '%' }"></div>
    </div>
    <small class="d-block mt-1 text-secondary">{{ app.matched }}/{{ app.total }} Skills Matched</small>

    <!-- only while the card is still in Saved: this is a pre-decision tool, not an ongoing one -->
    <button
      v-if="app.status === 'Saved'"
      type="button"
      class="btn btn-sm btn-outline-primary w-100 mt-2"
      v-on:pointerdown.stop
      v-on:click="emit('tailor-resume', app)"
    >
      <span v-if="app.skillGapScore != null" class="badge text-bg-light border me-1">{{ app.skillGapScore }}</span>
      Tailor Resume
    </button>

    <slot>
      <!-- Insert Dropdown Button to shift to other columns -->
    </slot>
  </div>
</template>

<style scoped>
  .app-card {
      border-radius: 18px;
      background: #eef5ff;
      border: 1px solid #dbe7fb;
  }

  .card-title {
      color: #0f1b3d;
      line-height: 1.35;
  }

  .star {
     color: #f5b301; 
  }

  .progress {
      height: 6px;
      border-radius: 80px;
      background: rgba(255, 255, 255, 0.9);
  }

  .progress-bar {
      border-radius: 99px;
      background: #2563eb;
  }
</style>