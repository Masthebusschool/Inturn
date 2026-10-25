<script setup>
import { formatDate } from '../helpers/KanbanViewHelper';
  defineProps({ app: Object })
</script>

<template>
  <div class="card rounded-4 shadow-sm p-3">
    <p class="fw-bold">{{ app.title }}</p>

    <div class="d-flex justify-content-between small text-secondary mt-2">
      <p>{{ app.company }}</p>
      <p>  - {{ formatDate(app.expiryDate) }}</p>
    </div>

    <div class="d-flex justify-content-between small text-secondary mt-2">
      <span>Checklist:</span>
      <span>{{ app.prep }} Prep</span>
    </div>
    
    <hr class="my-2" />

    <div class="progress">
      <div class="progress-bar bg-success" :style="{ width: (app.matched / app.total) * 100 + '%' }"></div>
    </div>
    <small class="mt-1">{{ app.matched }}/{{ app.total }} Skills Matched</small>
    <slot>
      <!-- Insert Dropdown Button to shift to other columns -->
    </slot>
  </div>
</template>