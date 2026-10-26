<script setup>
import { ref } from 'vue';

// only needs to know if the card is a favourite to switch the label
defineProps({ isFavourite: Boolean });

// tells the page which option was picked
const emit = defineEmits(['remove', 'favourite', 'checklist']);

const isOpen = ref(false);

function toggleMenu () { isOpen.value = !isOpen.value; }

// close the menu then tell the page
function pick (option) {
  isOpen.value = false;
  emit(option);
}
</script>

<template>
  <!-- pointerdown.stop so clicking the menu doesn't start dragging the card -->
  <div class="position-absolute top-0 end-0 m-3" v-on:pointerdown.stop>
    <button type="button" class="btn btn-sm btn-light border text-primary fw-bold py-0" v-on:click="toggleMenu" aria-label="Card options">
      &#8943;
    </button>

    <!-- dropdown-menu has a min width so it never squashes, end-0 opens it to the left of the button so it stays on screen -->
    <div v-if="isOpen" class="dropdown-menu d-block end-0 mt-1 shadow-sm p-1">
      <button type="button" class="dropdown-item rounded-2 px-2 py-2" v-on:click="pick('checklist')">
        <svg class="text-primary me-2" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="12" height="12" rx="3"/><path d="M5 8.2l2 2 4-4.4"/></svg>Checklist
      </button>
      <button type="button" class="dropdown-item rounded-2 px-2 py-2" v-on:click="pick('favourite')">
        <span class="text-warning me-2">&#9733;</span> {{ isFavourite ? 'Unfavourite' : 'Favourite' }}
      </button>
      <button type="button" class="dropdown-item rounded-2 px-2 py-2 text-danger" v-on:click="pick('remove')">
        <span class="me-2">&#10005;</span> Remove Card
      </button>
    </div>
  </div>
</template>