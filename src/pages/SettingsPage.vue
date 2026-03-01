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
  padding: var(--spacing-xl);
  max-width: 600px;
  margin: 0 auto;
}

h1 {
  font-size: var(--font-size-2xl);
  margin-bottom: var(--spacing-xl);
  color: var(--color-text-primary);
}

h2 {
  font-size: var(--font-size-xl);
  margin-top: var(--spacing-xl);
  margin-bottom: var(--spacing-md);
  color: var(--color-text-primary);
}

h3 {
  font-size: var(--font-size-lg);
  margin-top: var(--spacing-lg);
  margin-bottom: var(--spacing-sm);
  color: var(--color-text-primary);
}

/* Permission Status */
.permission-status {
  padding: var(--spacing-lg);
  border-radius: var(--border-radius-lg);
  margin-bottom: var(--spacing-xl);
  background-color: var(--color-bg-tertiary);
  border: var(--border-width) solid var(--color-border);
}

.permission-status.granted {
  background-color: var(--color-success-light);
  border-color: var(--color-success);
}

.permission-status.denied {
  background-color: var(--color-danger-light);
  border-color: var(--color-danger);
}

.status-message {
  margin: 0 0 var(--spacing-md) 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-normal);
}

/* Buttons */
.btn-primary,
.btn-secondary {
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  border: none;
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
  
  /* Touch-friendly minimum size */
  min-width: var(--touch-target-min);
  min-height: var(--touch-target-min);
  
  /* Prevent accidental double-tap zoom */
  touch-action: manipulation;
}

.btn-primary {
  background-color: var(--color-secondary);
  color: white;
}

.btn-primary:hover {
  background-color: var(--color-secondary-dark);
}

.btn-primary:active {
  transform: scale(0.98);
}

.btn-secondary {
  background-color: var(--color-text-secondary);
  color: white;
  margin-top: var(--spacing-md);
  width: 100%;
}

.btn-secondary:hover {
  background-color: var(--color-primary);
}

.btn-secondary:active {
  transform: scale(0.98);
}

.btn-secondary:disabled {
  background-color: var(--color-border);
  cursor: not-allowed;
}

/* Microphone Selection */
.microphone-selection {
  margin-top: var(--spacing-xl);
}

.no-devices {
  padding: var(--spacing-md);
  background-color: var(--color-warning-light);
  border: var(--border-width) solid var(--color-warning);
  border-radius: var(--border-radius-md);
  margin-bottom: var(--spacing-md);
}

.no-devices p {
  margin: 0;
  color: var(--color-warning-dark);
}

.device-list {
  margin-bottom: var(--spacing-md);
}

.device-item {
  margin-bottom: var(--spacing-sm);
}

.device-label {
  display: flex;
  align-items: center;
  padding: var(--spacing-md);
  background-color: var(--color-bg-primary);
  border: var(--border-width-thick) solid var(--color-border);
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
  
  /* Touch-friendly minimum size */
  min-height: var(--touch-target-min);
  
  /* Prevent accidental double-tap zoom */
  touch-action: manipulation;
}

.device-label:hover {
  background-color: var(--color-bg-secondary);
  border-color: var(--color-secondary);
}

.device-label:active {
  transform: scale(0.99);
}

.device-radio {
  margin-right: var(--spacing-md);
  cursor: pointer;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.device-name {
  flex: 1;
  font-size: var(--font-size-sm);
  word-break: break-word;
}

.current-badge {
  padding: var(--spacing-xs) var(--spacing-md);
  background-color: var(--color-secondary);
  color: white;
  border-radius: var(--border-radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  flex-shrink: 0;
  margin-left: var(--spacing-sm);
}

/* Current Selection */
.current-selection {
  padding: var(--spacing-md);
  background-color: var(--color-info-light);
  border: var(--border-width) solid var(--color-info);
  border-radius: var(--border-radius-md);
  margin-bottom: var(--spacing-md);
}

.current-selection h3 {
  margin-top: 0;
  margin-bottom: var(--spacing-sm);
}

.current-selection p {
  margin: 0;
  font-weight: var(--font-weight-medium);
  word-break: break-word;
}

/* Error Message */
.error-message {
  padding: var(--spacing-md);
  background-color: var(--color-danger-light);
  border: var(--border-width) solid var(--color-danger);
  border-radius: var(--border-radius-md);
  margin-top: var(--spacing-md);
}

.error-message p {
  margin: 0;
  color: var(--color-danger-dark);
  line-height: var(--line-height-normal);
}

/* Responsive Design */
@media (max-width: 768px) {
  .settings-page {
    padding: var(--spacing-md);
  }

  h1 {
    font-size: var(--font-size-xl);
  }

  h2 {
    font-size: var(--font-size-lg);
  }
}

@media (max-width: 480px) {
  .settings-page {
    padding: var(--spacing-sm);
  }
  
  .permission-status {
    padding: var(--spacing-md);
  }
  
  .device-label {
    padding: var(--spacing-sm);
  }
  
  .device-name {
    font-size: var(--font-size-xs);
  }
}

/* Landscape orientation support */
@media (orientation: landscape) and (max-height: 500px) {
  .settings-page {
    padding: var(--spacing-md);
  }
  
  h1 {
    font-size: var(--font-size-xl);
    margin-bottom: var(--spacing-md);
  }
  
  h2 {
    font-size: var(--font-size-lg);
    margin-top: var(--spacing-md);
    margin-bottom: var(--spacing-sm);
  }
}
</style>
