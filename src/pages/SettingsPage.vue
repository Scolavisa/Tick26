<template>
  <div class="settings-page">
    <h1>Audio Settings</h1>
    
    <!-- Permission Status -->
    <div class="permission-status" :class="{ granted: permissionGranted, denied: !permissionGranted && hasRequestedPermission }">
      <p v-if="permissionGranted" class="status-message">
        ✓ Microphone permission granted
      </p>
      <p v-else-if="hasRequestedPermission" class="status-message">
        ✗ Microphone permission denied
      </p>
      <p v-else class="status-message">
        Microphone permission not yet requested
      </p>
      
      <button 
        v-if="!permissionGranted" 
        @click="handleRequestPermission"
        class="btn-primary"
      >
        Grant Microphone Permission
      </button>
    </div>

    <!-- Microphone Selection -->
    <div v-if="permissionGranted" class="microphone-selection">
      <h2>Select Microphone</h2>
      
      <div v-if="availableDevices.length === 0" class="no-devices">
        <p>No microphones detected. Click refresh to scan for devices.</p>
      </div>
      
      <div v-else class="device-list">
        <div 
          v-for="device in availableDevices" 
          :key="device.deviceId"
          class="device-item"
        >
          <label class="device-label">
            <input
              type="radio"
              :value="device.deviceId"
              :checked="selectedDevice === device.deviceId"
              @change="handleSelectDevice(device.deviceId)"
              class="device-radio"
            />
            <span class="device-name">
              {{ device.label || `Microphone ${device.deviceId?.slice(0, 8) || 'Unknown'}...` }}
            </span>
            <span v-if="selectedDevice === device.deviceId" class="current-badge">
              Current
            </span>
          </label>
        </div>
      </div>

      <!-- Current Selection Display -->
      <div v-if="selectedDevice" class="current-selection">
        <h3>Current Selection</h3>
        <p>{{ getCurrentDeviceName() }}</p>
      </div>

      <!-- Refresh Devices Button -->
      <button 
        @click="handleRefreshDevices"
        class="btn-secondary"
        :disabled="isRefreshing"
      >
        {{ isRefreshing ? 'Refreshing...' : 'Refresh Devices' }}
      </button>
    </div>

    <!-- Error Display -->
    <div v-if="errorMessage" class="error-message">
      <p>{{ errorMessage }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * SettingsPage.vue - Audio input source configuration
 * Validates: Requirements 1.1, 1.2, 1.4
 * 
 * Features:
 * - Display list of available microphones
 * - Microphone selection with radio buttons
 * - Refresh devices functionality
 * - Display current selection
 * - Show permission status
 */

import { ref, onMounted } from 'vue';
import { useAudio } from '../composables/useAudio';

// Use the audio composable
const {
  selectedDevice,
  availableDevices,
  permissionGranted,
  requestPermission,
  enumerateDevices,
  selectDevice
} = useAudio();

// Local state
const hasRequestedPermission = ref(false);
const isRefreshing = ref(false);
const errorMessage = ref<string | null>(null);

/**
 * Request microphone permission
 */
const handleRequestPermission = async () => {
  try {
    errorMessage.value = null;
    hasRequestedPermission.value = true;
    
    const granted = await requestPermission();
    
    if (granted) {
      // Automatically enumerate devices after permission is granted
      await handleRefreshDevices();
    } else {
      errorMessage.value = 'Microphone permission was denied. Please grant permission in your browser settings.';
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to request permission';
  }
};

/**
 * Refresh the list of available audio devices
 */
const handleRefreshDevices = async () => {
  try {
    errorMessage.value = null;
    isRefreshing.value = true;
    
    await enumerateDevices();
    
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to refresh devices';
  } finally {
    isRefreshing.value = false;
  }
};

/**
 * Select a microphone device
 */
const handleSelectDevice = async (deviceId: string) => {
  try {
    errorMessage.value = null;
    
    await selectDevice(deviceId);
    
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to select device';
  }
};

/**
 * Get the name of the currently selected device
 */
const getCurrentDeviceName = (): string => {
  if (!selectedDevice.value) return 'None';
  
  const device = availableDevices.value.find(d => d.deviceId === selectedDevice.value);
  return device?.label || `Device ${selectedDevice.value?.slice(0, 8) || 'Unknown'}...`;
};

/**
 * Initialize on mount
 */
onMounted(async () => {
  // Check if permission was already granted
  if (permissionGranted.value) {
    hasRequestedPermission.value = true;
    await handleRefreshDevices();
  }
});
</script>

<style scoped>
.settings-page {
  padding: 2rem;
  max-width: 600px;
  margin: 0 auto;
}

h1 {
  font-size: 2rem;
  margin-bottom: 2rem;
  color: #2c3e50;
}

h2 {
  font-size: 1.5rem;
  margin-top: 2rem;
  margin-bottom: 1rem;
  color: #2c3e50;
}

h3 {
  font-size: 1.2rem;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  color: #2c3e50;
}

/* Permission Status */
.permission-status {
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  background-color: #f5f5f5;
}

.permission-status.granted {
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
}

.permission-status.denied {
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
}

.status-message {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 500;
}

/* Buttons */
.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  min-width: 44px;
  min-height: 44px;
}

.btn-primary {
  background-color: #42b983;
  color: white;
}

.btn-primary:hover {
  background-color: #359268;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
  margin-top: 1rem;
}

.btn-secondary:hover {
  background-color: #5a6268;
}

.btn-secondary:disabled {
  background-color: #adb5bd;
  cursor: not-allowed;
}

/* Microphone Selection */
.microphone-selection {
  margin-top: 2rem;
}

.no-devices {
  padding: 1rem;
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.device-list {
  margin-bottom: 1rem;
}

.device-item {
  margin-bottom: 0.5rem;
}

.device-label {
  display: flex;
  align-items: center;
  padding: 1rem;
  background-color: #f8f9fa;
  border: 2px solid #dee2e6;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 44px;
}

.device-label:hover {
  background-color: #e9ecef;
  border-color: #42b983;
}

.device-radio {
  margin-right: 1rem;
  cursor: pointer;
  width: 20px;
  height: 20px;
}

.device-name {
  flex: 1;
  font-size: 1rem;
}

.current-badge {
  padding: 0.25rem 0.75rem;
  background-color: #42b983;
  color: white;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
}

/* Current Selection */
.current-selection {
  padding: 1rem;
  background-color: #e7f3ff;
  border: 1px solid #b3d9ff;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.current-selection p {
  margin: 0;
  font-weight: 500;
}

/* Error Message */
.error-message {
  padding: 1rem;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  margin-top: 1rem;
  color: #721c24;
}

.error-message p {
  margin: 0;
}

/* Responsive Design */
@media (max-width: 768px) {
  .settings-page {
    padding: 1rem;
  }

  h1 {
    font-size: 1.5rem;
  }

  h2 {
    font-size: 1.25rem;
  }
}
</style>
