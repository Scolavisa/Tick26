<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="app">
    <nav class="navigation">
      <router-link to="/" class="nav-button" :class="{ active: route.name === 'measurement' }">
        Measurement
      </router-link>
      <router-link to="/calibration" class="nav-button" :class="{ active: route.name === 'calibration' }">
        Calibration
      </router-link>
      <router-link to="/settings" class="nav-button" :class="{ active: route.name === 'settings' }">
        Settings
      </router-link>
    </nav>
    
    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
  background-color: var(--color-bg-secondary);
}

.navigation {
  display: flex;
  justify-content: space-around;
  align-items: center;
  background-color: var(--color-primary);
  padding: var(--spacing-sm);
  box-shadow: var(--shadow-md);
  
  /* Prevent accidental navigation */
  touch-action: manipulation;
  user-select: none;
  
  /* Sticky navigation for better UX */
  position: sticky;
  top: 0;
  z-index: var(--z-index-dropdown);
}

.nav-button {
  flex: 1;
  padding: var(--spacing-md);
  text-align: center;
  text-decoration: none;
  color: white;
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
  transition: background-color var(--transition-base);
  border-radius: var(--border-radius-md);
  margin: 0 var(--spacing-xs);
  
  /* Touch-friendly minimum size */
  min-height: var(--touch-target-min);
  min-width: var(--touch-target-min);
  
  display: flex;
  align-items: center;
  justify-content: center;
  
  /* Prevent accidental double-tap zoom */
  touch-action: manipulation;
}

.nav-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.nav-button:active {
  background-color: rgba(255, 255, 255, 0.15);
  transform: scale(0.98);
}

.nav-button.active {
  background-color: var(--color-secondary);
  font-weight: var(--font-weight-semibold);
}

.content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

/* Responsive adjustments */
@media (max-width: 480px) {
  .navigation {
    padding: var(--spacing-xs);
  }
  
  .nav-button {
    padding: var(--spacing-sm) var(--spacing-xs);
    font-size: var(--font-size-xs);
    margin: 0 2px;
  }
}

/* Landscape orientation support */
@media (orientation: landscape) and (max-height: 500px) {
  .navigation {
    padding: var(--spacing-xs);
  }
  
  .nav-button {
    padding: var(--spacing-sm);
    font-size: var(--font-size-xs);
  }
}
</style>
