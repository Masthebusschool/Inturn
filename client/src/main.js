import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import 'bootstrap-icons/font/bootstrap-icons.css';
import "vue-multiselect/dist/vue-multiselect.css";
import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import './assets/main.css'
createApp(App).use(router).mount('#app')
