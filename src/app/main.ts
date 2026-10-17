import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './scale.css'
import './theme.css'

createApp(App).use(createPinia()).mount('#app')
