import { reactive } from 'vue'
import * as authApi from '../api/auth.js'
import * as profileApi from '../api/profile.js'
import { resumeStore } from './resume.js'

// Who is logged in, shared by every page. Usage:
//   import { authStore } from '../stores/auth.js'
//   authStore.user?.name, authStore.isLoggedIn
// Shared by every fetchMe() call made while one request is still in flight
let pendingFetch = null
// Bumped on login/logout so an older fetchMe() answer cannot overwrite them
let authVersion = 0

export const authStore = reactive({
  user: null,
  checked: false, // true once we have asked the server who is logged in

  get isLoggedIn() {
    return this.user !== null
  },

  // Ask the server who is logged in (e.g. after a page refresh).
  // Safe to call from several places at once: they share one request.
  fetchMe() {
    if (!pendingFetch) {
      const version = authVersion
      pendingFetch = authApi
        .getMe()
        .then(({ user }) => user)
        .catch(() => null)
        .then((user) => {
          if (version === authVersion) this.user = user
          this.checked = true
          pendingFetch = null
          return this.user
        })
    }
    return pendingFetch
  },

  async login(credentials) {
    const { user } = await authApi.login(credentials)
    authVersion++
    this.user = user
    this.checked = true
    return user
  },

  // Creates the account and logs it in immediately (the server starts a session on signup).
  async signup(details) {
    const { user } = await authApi.signup(details)
    authVersion++
    this.user = user
    this.checked = true
    return user
  },

  async logout() {
    await authApi.logout()
    authVersion++
    this.user = null
    // So the next person to log in on this browser does not see this resume
    resumeStore.clear()
  },

  // Hard-deletes the account (the server ends the session), then mirrors logout().
  async deleteAccount(confirmEmail) {
    await profileApi.deleteAccount(confirmEmail)
    authVersion++
    this.user = null
    resumeStore.clear()
  },

  // Saves name and education; keeps the stored user in sync.
  async updateProfile(details) {
    const { user } = await profileApi.updateProfile(details)
    this.user = user
    return user
  },

  async changeEmail(details) {
    const { user } = await authApi.changeEmail(details)
    this.user = user
    return user
  },

  async changePassword(details) {
    return authApi.changePassword(details)
  },
})
