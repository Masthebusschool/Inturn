import 'bootstrap/dist/css/bootstrap.min.css'
// The bundle includes Popper, so no separate import is needed; it powers the navbar collapse toggler.
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'

createApp(App).use(router).mount('#app')
