<script setup>
import { onMounted, onUnmounted } from 'vue';

defineProps({
    type: { type: String, default: 'normal' }, // normal is green, anything else is red
    message: { type: String, default: '' }
});

// tells the page to hide the toast
const emit = defineEmits(['close']);

let timer = null;

// close by itself after 5 seconds
onMounted(() => {
    timer = setTimeout(() => {
        emit('close');
    }, 5000);
});

// stop the timer if the toast is closed early 
onUnmounted(() => {
    clearTimeout(timer);
});

</script>

<template>
    <!-- fixed in the bottom right corner -->
    <div class="toast-container position-fixed bottom-0 end-0 p-3">
        <div class="toast show" role="alert" aria-live="assertive" aria-atomic="true" :class="type !== 'normal' ? 'text-bg-danger' : 'text-bg-success'">
            <div class="toast-header">
                <p class="me-auto h5">{{ type !== 'normal' ? 'Error' : 'Success' }}</p>
                <button type="button" class="btn-close" aria-label="Close" v-on:click="emit('close')"></button>
            </div>
            <div class="toast-body">
                {{ message }}
            </div>
        </div>
    </div>
</template>