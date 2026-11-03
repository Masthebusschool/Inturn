<script setup>
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from './components/layout/AppSidebar.vue'
import { authStore } from './stores/auth.js'
import { restoreMatchingResume } from "./stores/jobMatch.js";

const route = useRoute()

// Find out who is logged in once, so the sidebar can show Log in / Log out.
onMounted(async() => {await authStore.fetchMe(); await restoreMatchingResume()})
</script>

<template>
  <!-- Login, sign up and onboarding are full pages without the sidebar (route meta.fullPage) -->
  <main v-if="route.meta.fullPage" class="full-page"><div class="container py-4"><RouterView /></div></main>

  <div v-else class="app-layout">
    <AppSidebar />
    <main class="app-main"><RouterView /></main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
}

/* The only place that sets page background and page padding; views add none of their own */
.full-page {
  min-height: 100vh;
  background: var(--inturn-page-bg);
}

.app-main {
  flex: 1;
  min-width: 0;
  padding: 1.5rem;
  background: var(--inturn-page-bg);
}

@media (max-width: 767.98px) {
  .app-layout {
    flex-direction: column;
  }

  .app-main {
    padding: 1rem;
  }
}
</style>
