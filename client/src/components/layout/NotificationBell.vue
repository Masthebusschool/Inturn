<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { notificationStore } from '../../stores/notifications.js'

// The bell button and its dropdown list. The parent (AppSidebar) owns `open`,
// so it can close the hamburger menu when this opens and the other way round.
const open = defineModel('open', { type: Boolean, default: false })

const root = ref(null)

// Close when clicking anywhere outside the bell and its list.
// composedPath() is the path at click time, so a button that removes itself
// (like "Mark all as read") still counts as inside.
function closeOnOutsideClick(event) {
  if (open.value && root.value && !event.composedPath().includes(root.value)) open.value = false
}
onMounted(() => document.addEventListener('click', closeOnOutsideClick))
onBeforeUnmount(() => document.removeEventListener('click', closeOnOutsideClick))

// e.g. "just now", "5 min ago", "3 h ago", "2 d ago", then the date
function timeAgo(isoDate) {
  const minutes = Math.floor((Date.now() - new Date(isoDate)) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} d ago`
  return new Date(isoDate).toLocaleDateString()
}

function openNotification(notification) {
  notification.read = true
  open.value = false
}
</script>

<template>
  <div ref="root" class="notification-bell">
    <button
      type="button"
      class="bell-button"
      aria-controls="notification-panel"
      :aria-expanded="open"
      :aria-label="notificationStore.unreadCount ? `Notifications, ${notificationStore.unreadCount} unread` : 'Notifications'"
      @click="open = !open"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" />
      </svg>
      <span v-if="notificationStore.unreadCount" class="badge-count" aria-hidden="true">
        {{ notificationStore.unreadCount > 9 ? '9+' : notificationStore.unreadCount }}
      </span>
    </button>

    <div v-if="open" id="notification-panel" class="panel" role="region" aria-label="Notifications">
      <div class="panel-head">
        <h2 class="panel-title">Notifications</h2>
        <button
          v-if="notificationStore.unreadCount"
          type="button"
          class="btn-link-inturn"
          @click="notificationStore.markAllRead()"
        >
          Mark all as read
        </button>
      </div>

      <ul v-if="notificationStore.items.length" class="notification-list">
        <li v-for="notification in notificationStore.items" :key="notification.id">
          <component
            :is="notification.link ? 'RouterLink' : 'div'"
            :to="notification.link"
            class="notification"
            :class="{ unread: !notification.read }"
            @click="openNotification(notification)"
          >
            <span class="unread-dot" aria-hidden="true"></span>
            <span class="notification-body">
              <span class="notification-title">{{ notification.title }}</span>
              <span v-if="notification.message" class="notification-message">{{ notification.message }}</span>
              <span class="notification-time">{{ timeAgo(notification.createdAt) }}</span>
            </span>
            <span v-if="!notification.read" class="visually-hidden">(unread)</span>
          </component>
        </li>
      </ul>

      <div v-else class="empty">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" />
        </svg>
        <p class="mb-0">You're all caught up</p>
        <p class="muted mb-0">New notifications will show up here.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notification-bell {
  position: relative;
}

.bell-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: var(--inturn-text);
  background: none;
  border: none;
  border-radius: var(--r-sm);
}

.bell-button:hover,
.bell-button[aria-expanded='true'] {
  background: var(--inturn-surface-muted);
}

.bell-button:focus-visible {
  outline: 2px solid var(--inturn-primary);
}

.bell-button svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.badge-count {
  position: absolute;
  top: 3px;
  right: 2px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: var(--r-pill);
  background: var(--inturn-danger);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
  /* White ring so the badge stands out from the white sidebar */
  box-shadow: 0 0 0 2px #fff;
}

/* Dropdown: under the bell on large screens */
.panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 1050;
  width: 320px;
  max-height: 420px;
  overflow-y: auto;
  background: var(--inturn-surface);
  color: var(--inturn-text);
  border-radius: var(--r-md);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--inturn-border);
}

.panel-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
}

.notification-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.notification {
  display: flex;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid var(--inturn-border);
}

a.notification:hover {
  background: var(--inturn-surface-muted);
}

.unread-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  margin-top: 0.45rem;
  border-radius: 50%;
  background: transparent;
}

.notification.unread .unread-dot {
  background: var(--inturn-primary);
}

.notification.unread {
  background: var(--inturn-surface-muted);
}

.notification-body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.notification-title {
  font-weight: 600;
  font-size: 0.9rem;
}

.notification-message {
  font-size: 0.85rem;
  color: var(--inturn-text-soft);
}

.notification-time,
.muted {
  font-size: 0.75rem;
  color: var(--inturn-text-muted);
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 1.75rem 1rem;
  text-align: center;
}

.empty svg {
  width: 32px;
  height: 32px;
  margin-bottom: 0.25rem;
  fill: none;
  stroke: var(--inturn-primary);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Small screens: a full-width panel under the top bar */
@media (max-width: 767.98px) {
  .notification-bell {
    position: static;
  }

  .panel {
    top: 100%;
    left: 0;
    right: 0;
    width: auto;
    max-height: 70vh;
    border-radius: 0 0 var(--r-md) var(--r-md);
  }
}
</style>
