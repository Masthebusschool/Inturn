<script setup>
// for card that is being deleted, to pass info
defineProps(
    {
        card: Object,
        errorMessage: { type: String, default: ' '}
    }
);

const emit = defineEmits(['confirm', 'cancel']);

function confirmDelete() {
    emit('confirm');
}

function cancelDelete() {
    emit('cancel'); // do nothing
}

</script>

<template>
    <div class="modal d-block" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
        <div class="modal-header">
            <h2 class="modal-title h5">Delete Application Card Confirmation</h2>
            <button type="button" class="btn-close" aria-label="Close" v-on:click="cancelDelete"></button>
        </div>
        <div class="modal-body">
            <!-- backend error, only shows if deleting failed -->
            <div v-if="errorMessage" class="alert alert-danger py-2">{{ errorMessage }}</div>

            <p class="mb-0">You are about to delete <span class="text-primary">"{{ card.company }} - {{ card.title }}"</span> from your applications track board. Click "Delete" to confirm.</p>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn-neutral-inturn" v-on:click="cancelDelete">Cancel</button>
            <button type="button" class="btn-danger-inturn" v-on:click="confirmDelete">Delete</button>
        </div>
        </div>
    </div>
    </div>
    <!-- dark background behind the modal -->
    <div class="modal-backdrop show"></div>
</template>