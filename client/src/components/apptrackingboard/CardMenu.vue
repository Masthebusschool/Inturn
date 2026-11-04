<script setup>
import { ref } from 'vue';

defineProps({ isFavourite: Boolean });

const emit = defineEmits(['edit', 'delete', 'favourite', 'checklist']);

const isOpen = ref(false);
function toggleMenu () { isOpen.value = !isOpen.value; }

// close the menu then tell the page
function pick (option) {
  isOpen.value = false;
  emit(option);
}

</script>

<template>
  <!-- pointerdown.stop so clicking on the menu won't drag the card -->
  <div class="position-absolute top-0 end-0 m-3" v-on:pointerdown.stop>
    <button type="button" class="btn-neutral-inturn btn-sm-inturn" v-on:click="toggleMenu" aria-label="Card options">
      &#8943;
    </button>

    <div v-if="isOpen" class="dropdown-menu d-block end-0 mt-1 shadow-sm p-1">
      <button type="button" class="dropdown-item rounded-2 px-2 py-2" v-on:click="pick('edit')">
        <i class="bi bi-pencil text-primary me-2"></i>Edit Card
      </button>
      <button type="button" class="dropdown-item rounded-2 px-2 py-2" v-on:click="pick('checklist')">
        <svg class="text-primary me-2" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="12" height="12" rx="3"/><path d="M5 8.2l2 2 4-4.4"/></svg>Checklist
      </button>
      <button type="button" class="dropdown-item rounded-2 px-2 py-2" v-on:click="pick('favourite')">
        <span class="text-warning me-2">&#9733;</span> {{ isFavourite ? 'Unfavourite' : 'Favourite' }}
      </button>
      <button type="button" class="dropdown-item rounded-2 px-2 py-2 text-danger" v-on:click="pick('delete')">
        <span class="me-2">&#10005;</span> Delete Card
      </button>
    </div>
  </div>
</template>