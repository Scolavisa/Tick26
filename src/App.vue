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
  height: 100vh;
  width: 100%;
}

.navigation {
  display: flex;
  justify-content: space-around;
  align-items: center;
  background-color: #2c3e50;
  padding: 0.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.nav-button {
  flex: 1;
  padding: 1rem;
  text-align: center;
  text-decoration: none;
  color: #ffffff;
  font-weight: 500;
  transition: background-color 0.2s;
  border-radius: 4px;
  margin: 0 0.25rem;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.nav-button.active {
  background-color: #42b883;
}

.content {
  flex: 1;
  overflow-y: auto;
}
</style>
