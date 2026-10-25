import { reactive } from 'vue'

// Notifications for the logged-in user, shown by the bell in the sidebar.
// Each notification:
//   { id, title, message, link, createdAt, read }
//   link is an optional app path to open on click (e.g. '/shortlist'); createdAt is an ISO date
//
// TODO(team): there is no backend yet, so the list stays empty. Once the API is agreed, e.g.
//   GET  /api/notifications           -> { notifications: [...] }
//   POST /api/notifications/read-all  -> marks them all as read
// add a load() here that fills `items`, and make markAllRead() call the server too.
export const notificationStore = reactive({
  items: [],

  get unreadCount() {
    return this.items.filter((notification) => !notification.read).length
  },

  markAllRead() {
    for (const notification of this.items) notification.read = true
  },

  // Called on logout so the next person on this browser does not see them
  clear() {
    this.items = []
  },
})
