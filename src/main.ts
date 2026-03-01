import { createApp } from 'vue'
import './styles/main.css'
import App from './App.vue'
import router from './router'

createApp(App)
  .use(router)
  .mount('#app')

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[App] Service Worker registered:', registration.scope)
        
        // Check for updates periodically
        setInterval(() => {
          registration.update()
        }, 60000) // Check every minute
      })
      .catch((error) => {
        console.error('[App] Service Worker registration failed:', error)
      })
  })
}
