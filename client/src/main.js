import 'bootstrap/dist/css/bootstrap.min.css'
// The bundle includes Popper, so no separate import is needed; it powers the navbar collapse toggler.
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import 'bootstrap-icons/font/bootstrap-icons.css';
import "vue-multiselect/dist/vue-multiselect.css";
import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
// After Bootstrap, so the Inturn styles win
import './assets/main.css'
createApp(App).use(router).mount('#app')
