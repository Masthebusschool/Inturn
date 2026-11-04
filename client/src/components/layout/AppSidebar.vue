<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authStore } from '../../stores/auth.js'

const route = useRoute()
const router = useRouter()

// Small screens only: the menu is hidden behind the hamburger button
const menuOpen = ref(false)

// Close the menu after moving to another page
watch(() => route.fullPath, () => {
  menuOpen.value = false
})

function closeOnEscape(event) {
  if (event.key !== 'Escape') return
  menuOpen.value = false
}
onMounted(() => document.addEventListener('keydown', closeOnEscape))
onBeforeUnmount(() => document.removeEventListener('keydown', closeOnEscape))

// Site-wide navigation. Each icon is a 16x16 outline path drawn in white.
const links = [
  { to: '/jobs', label: 'Internship Discovery', icon: 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM1.5 8h13M8 1.5c-2 2-2.8 4-2.8 6.5S6 12.5 8 14.5M8 1.5c2 2 2.8 4 2.8 6.5S10 12.5 8 14.5' },
  { to: '/applications', label: 'Tracker Board', icon: 'M5.5 2h5v1.5h-5zM4 3H3v11.5h10V3h-1M5.5 7.5h5M5.5 10h5M5.5 12.5h3' },
  { to: '/intel', label: 'Interview Intel', icon: 'M1.5 2.5h13v8h-13zM8 10.5v3M5 14.5h6M4 5h4M4 7.5h7' },
  { to: '/mock-interview', label: 'Interview Journal', icon: 'M3.5 1.5h9v13h-9zM6 1.5v13M8 5h2.5M8 8h2.5M2 4h1.5M2 8h1.5M2 12h1.5' },
  { to: '/skill-gap', label: 'Skill Gap Analysis', icon: 'M3 1.5h7l3 3v10H3zM10 1.5v3h3M5.5 8h5M5.5 10.5h5M5.5 13h3' },
  { to: '/resumes', label: 'My Resumes', icon: 'M5 3.5h5.5l2.5 2.5v8.5H5zM10.5 3.5V6H13M3 12V1.5h6' },
  { to: '/profile', label: 'Profile', icon: 'M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.5 6.5c0-2.6 2.5-4.5 5.5-4.5s5.5 1.9 5.5 4.5' },
]

async function handleLogout() {
  menuOpen.value = false
  await authStore.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="brand">
        <span >
          <img src="../../assets/logogogo.jpg" class="brand-logo">
        </span>
        <span class="brand-name">Inturn</span>
      </div>

      <!-- Hamburger: only shown on small screens -->
      <button
        type="button"
        class="menu-toggle"
        aria-controls="sidebar-menu"
        :aria-expanded="menuOpen"
        :aria-label="menuOpen ? 'Close menu' : 'Open menu'"
        @click="menuOpen = !menuOpen"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path v-if="menuOpen" d="M6 6l12 12M18 6 6 18" />
          <path v-else d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
    </div>

    <!-- Always visible on large screens; opened by the hamburger on small screens -->
    <div id="sidebar-menu" class="sidebar-menu" :class="{ open: menuOpen }">
      <nav aria-label="Main">
        <ul class="nav-list">
          <li v-for="link in links" :key="link.to">
            <RouterLink :to="link.to" class="nav-item" active-class="active">
              <svg class="nav-icon" viewBox="0 0 16 16" aria-hidden="true">
                <path :d="link.icon" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>{{ link.label }}</span>
            </RouterLink>
          </li>
        </ul>
      </nav>

      <div class="sidebar-footer">
        <button v-if="authStore.isLoggedIn" type="button" class="nav-item footer-button" @click="handleLogout">
          <svg class="nav-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 2.5H3v11h3M10.5 5l3 3-3 3M13.5 8H6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>Log out</span>
        </button>
        <RouterLink v-else-if="authStore.checked" :to="{ name: 'login' }" class="nav-item">
          <svg class="nav-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 2.5h3v11h-3M2.5 8h7.5M7 5l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>Log in</span>
        </RouterLink>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  width: 220px;
  /* Exactly one viewport tall and not stretched by the flex row: a sticky box as tall as
     its container cannot stick, so a stretched sidebar scrolled away with the page. */
  height: 100vh;
  height: 100dvh;
  align-self: flex-start;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  background: var(--inturn-surface);
  color:black;
  border-right: 1px solid rgb(221, 219, 219);
  padding:12px;
}

/* Large screens: brand at the top */
.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 0.75rem 3rem 1.25rem;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

/* Hidden on large screens; see the media query below */
.menu-toggle {
  display: none;
}

.sidebar-menu {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}

/* On very short viewports only the link list scrolls; the footer stays visible */
.sidebar-menu nav {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.brand-logo {
  height:32px;
  width:auto;
}

.brand-name {
  font-size: 1.6rem;
  font-weight: 700;
}

.nav-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 1rem 1.25rem;
  color: black;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  background: none;
  border: none;
  border-radius: var(--r-sm);
  text-align: left;
}

.nav-item:hover {
  background: var(--inturn-surface-muted);
}

.nav-item.active {
  background: var(--inturn-primary-soft);
  color: #2f5f9e; 
  font-weight: 600;
}

.nav-item:focus-visible {
  outline: 2px solid var(--inturn-primary);
  outline-offset: -2px;
}

.nav-icon {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
}

.sidebar-footer {
  flex-shrink: 0;
  margin-top: auto;
  padding-bottom: 1rem;
}

/* Small screens: a bar across the top with a hamburger that opens the menu */
@media (max-width: 767.98px) {
  .sidebar {
    width: 100%;
    height: auto;
    align-self: auto;
    z-index: 1020;
    /* A top bar now, so the divider goes underneath instead of on the right */
    border-right: none;
    border-bottom: 1px solid rgb(221, 219, 219);
  }

  .sidebar-header {
    gap: 0.25rem;
    padding: 0.4rem 0.5rem 0.4rem 1rem;
  }

  /* Push the hamburger to the right */
  .brand {
    margin-right: auto;
  }

  .brand-name {
    font-size: 1.25rem;
  }

  .menu-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    color: black;
    background: none;
    border: none;
    border-radius: var(--r-sm);
  }

  .menu-toggle:hover {
    background: var(--inturn-surface-muted);
  }

  .menu-toggle:focus-visible {
    outline: 2px solid var(--inturn-primary);
  }

  .menu-toggle svg {
    width: 26px;
    height: 26px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }

  .sidebar-menu {
    display: none;
    position: sticky;
    top: calc(100% + 8px);
    left: 16px;
    right: 16px;
    padding: 0.5rem;
    background: var(--inturn-surface);
    border: 1px solid var(--inturn-border);
    border-radius: var(--r-md);
    box-shadow: 0 30px 40px rgba(15, 23, 42, 0.08);
  }

  .sidebar-menu.open {
    display: block;
  }

  .sidebar-menu nav {
    overflow-y: visible;
  }

  .nav-item {
    padding: 0.75rem 1rem;
  }

  .sidebar-footer {
    padding-bottom: 0;
    border-top: 1px solid rgb(221, 219, 219);
  }
}
</style>
