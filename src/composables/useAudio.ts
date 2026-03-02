/**
 * useAudio - Vue 3 Composition API wrapper for AudioManager
 * Validates: Requirements 1.2, 1.3, 1.5, 8.1, 8.3
 * 
 * This composable provides:
 * - Reactive state for audio system status
 * - Microphone permission management
 * - Audio device enumeration and selection
 * - AudioManager lifecycle management
 * - Device selection persistence to localStorage
 * - Singleton pattern for shared state across components
 */

import { ref, type Ref } from 'vue';
import { AudioManager } from '../audio/AudioManager';
import type { TickEvent, ErrorInfo } from '../types';
import { ErrorCode } from '../types';
import { logError, createErrorFromCode } from '../utils/errors';

// Singleton state - shared across all component instances
let audioManagerInstance: AudioManager | null = null;
let isSharedStateInitialized = false;

// Shared reactive state
const audioContext: Ref<AudioContext | null> = ref(null);
const selectedDevice: Ref<string | null> = ref(null);
const availableDevices: Ref<MediaDeviceInfo[]> = ref([]);
const isInitialized: Ref<boolean> = ref(false);
const permissionGranted: Ref<boolean> = ref(false);
const currentError: Ref<ErrorInfo | null> = ref(null);

// localStorage key for device persistence
const STORAGE_KEY = 'tick-tack-microphone';

/**
 * useAudio composable
 * Returns reactive state and methods for audio system management
 */
export function useAudio() {
  // Initialize shared state on first use
  if (!isSharedStateInitialized) {
    // Load persisted device selection
    const savedDeviceId = localStorage.getItem(STORAGE_KEY);
    if (savedDeviceId) {
      selectedDevice.value = savedDeviceId;
      // If we have a saved device, permission must have been granted previously
      // (we'll verify this when the device is actually used)
      permissionGranted.value = true;
    }
    
    isSharedStateInitialized = true;
  }

  // Get or create AudioManager instance
  const getAudioManager = (): AudioManager => {
    if (!audioManagerInstance) {
      audioManagerInstance = new AudioManager();
    }
    return audioManagerInstance;
  };

  /**
   * Request microphone permission
   * Validates: Requirement 8.1, 8.2
   * 
   * @returns Promise<boolean> - true if permission granted, false otherwise
   */
  const requestPermission = async (): Promise<boolean> => {
    try {
      // Clear any previous errors
      currentError.value = null;
      
      // Request microphone access with basic constraints
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Permission granted - stop the stream immediately
      stream.getTracks().forEach(track => track.stop());
      
      permissionGranted.value = true;
      return true;
    } catch (error) {
      permissionGranted.value = false;
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          // Handle microphone permission denied (Requirement 8.2)
          const errorInfo = createErrorFromCode(ErrorCode.MICROPHONE_PERMISSION_DENIED);
          logError(errorInfo);
          currentError.value = errorInfo;
        } else if (error.name === 'NotFoundError') {
          // No microphone found
          const errorInfo = createErrorFromCode(ErrorCode.MICROPHONE_ACCESS_FAILED);
          logError(errorInfo);
          currentError.value = errorInfo;
        } else {
          // Other microphone access failures
          const errorInfo = createErrorFromCode(ErrorCode.MICROPHONE_ACCESS_FAILED);
          logError(errorInfo);
          currentError.value = errorInfo;
        }
      }
      
      return false;
    }
  };

  /**
   * Enumerate available audio input devices
   * Validates: Requirement 1.3
   * 
   * @returns Promise<MediaDeviceInfo[]> - List of available audio input devices
   */
  const enumerateDevices = async (): Promise<MediaDeviceInfo[]> => {
    try {
      // Get all media devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      // Filter for audio input devices only
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      
      availableDevices.value = audioInputs;
      return audioInputs;
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
      availableDevices.value = [];
      return [];
    }
  };

  /**
   * Select and activate a specific microphone device
   * Validates: Requirements 1.2, 1.5, 14.1
   * 
   * @param deviceId - The device ID to select and activate
   */
  const selectDevice = async (deviceId: string): Promise<void> => {
    try {
      // Clear any previous errors
      currentError.value = null;
      
      const manager = getAudioManager();
      
      // If already initialized, clean up first
      if (isInitialized.value) {
        manager.cleanup();
        isInitialized.value = false;
      }
      
      // Initialize with the selected device
      await manager.initialize(deviceId);
      
      // Update reactive state
      selectedDevice.value = deviceId;
      isInitialized.value = true;
      
      // If initialization succeeded, permission must have been granted
      // (otherwise getUserMedia would have failed)
      permissionGranted.value = true;
      
      // Get the AudioContext from the manager
      const state = manager.getState();
      if (state.initialized) {
        // Store reference (AudioContext is private in AudioManager)
        // We track initialization state instead
        audioContext.value = null; // AudioContext is managed internally by AudioManager
      }
      
      // Persist device selection to localStorage
      localStorage.setItem(STORAGE_KEY, deviceId);
      
    } catch (error) {
      isInitialized.value = false;
      selectedDevice.value = null;
      
      // Handle microphone access failure (Requirement 14.1)
      const errorInfo = createErrorFromCode(ErrorCode.MICROPHONE_ACCESS_FAILED);
      logError(errorInfo);
      currentError.value = errorInfo;
      
      if (error instanceof Error) {
        throw new Error(`Failed to select device: ${error.message}`);
      }
      throw error;
    }
  };

  /**
   * Initialize the AudioWorklet processor
   * Must be called after device selection and before starting processing
   * Validates: Requirements 14.2, 14.3
   * 
   * @throws Error if initialization fails
   */
  const initializeWorklet = async (): Promise<void> => {
    try {
      // Clear any previous errors
      currentError.value = null;
      
      const manager = getAudioManager();
      
      if (!isInitialized.value) {
        throw new Error('Audio system not initialized. Call selectDevice() first.');
      }
      
      // Load the AudioWorklet processor
      try {
        await manager.loadWorklet();
      } catch (error) {
        // Handle AudioWorklet initialization failure (Requirement 14.2)
        const errorInfo = createErrorFromCode(ErrorCode.AUDIOWORKLET_INIT_FAILED);
        logError(errorInfo);
        currentError.value = errorInfo;
        throw error;
      }
      
      // Load the WASM module with retry logic (Requirement 14.3)
      let wasmLoadAttempts = 0;
      const maxWasmAttempts = 2;
      
      while (wasmLoadAttempts < maxWasmAttempts) {
        try {
          await manager.loadWasm();
          break; // Success, exit retry loop
        } catch (error) {
          wasmLoadAttempts++;
          
          if (wasmLoadAttempts >= maxWasmAttempts) {
            // Handle WASM load failure after retries (Requirement 14.3)
            const errorInfo = createErrorFromCode(ErrorCode.WASM_LOAD_FAILED);
            logError(errorInfo);
            currentError.value = errorInfo;
            throw error;
          }
          
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to initialize worklet: ${error.message}`);
      }
      throw error;
    }
  };

  /**
   * Start audio processing
   * Begins capturing and processing audio from the selected microphone
   * Validates: Requirement 8.4
   * 
   * @throws Error if audio system is not fully initialized
   */
  const startProcessing = (): void => {
    const manager = getAudioManager();
    
    if (!isInitialized.value) {
      throw new Error('Audio system not initialized. Call selectDevice() first.');
    }
    
    // Monitor for permission revocation during operation (Requirement 8.4)
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    }
    
    manager.start();
  };
  
  /**
   * Handle device changes (including permission revocation)
   * Validates: Requirement 8.4
   */
  const handleDeviceChange = async () => {
    // Check if we still have permission
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      
      // If we had a selected device but it's no longer available
      if (selectedDevice.value && !audioInputs.find(d => d.deviceId === selectedDevice.value)) {
        // Permission may have been revoked or device disconnected
        stopProcessing();
        
        const errorInfo = createErrorFromCode(ErrorCode.MICROPHONE_ACCESS_FAILED);
        logError(errorInfo);
        currentError.value = errorInfo;
      }
    } catch (error) {
      // Permission was revoked
      stopProcessing();
      permissionGranted.value = false;
      
      const errorInfo = createErrorFromCode(ErrorCode.MICROPHONE_PERMISSION_DENIED);
      logError(errorInfo);
      currentError.value = errorInfo;
    }
  };

  /**
   * Stop audio processing
   * Stops capturing and processing audio but keeps resources allocated
   */
  const stopProcessing = (): void => {
    // Remove device change listener
    if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    }
    
    if (audioManagerInstance) {
      audioManagerInstance.stop();
    }
  };

  /**
   * Clean up all audio resources
   * Stops processing, closes streams, and releases AudioContext
   */
  const cleanup = (): void => {
    // Remove device change listener
    if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    }
    
    if (audioManagerInstance) {
      audioManagerInstance.cleanup();
      audioManagerInstance = null;
    }
    
    // Reset reactive state
    audioContext.value = null;
    isInitialized.value = false;
    currentError.value = null;
    // Keep selectedDevice and permissionGranted for persistence
  };

  /**
   * Register a callback for tick detection events
   * 
   * @param callback - Function to call when a tick is detected
   */
  const onTickDetected = (callback: (event: TickEvent) => void): void => {
    const manager = getAudioManager();
    manager.onTickDetected(callback);
  };

  /**
   * Set calibration parameters for tick detection
   * 
   * @param sensitivity - Sensitivity multiplier (0.1 - 2.0)
   * @param threshold - RMS amplitude threshold (0.01 - 0.5)
   */
  const setCalibration = (sensitivity: number, threshold: number): void => {
    const manager = getAudioManager();
    manager.setCalibration(sensitivity, threshold);
  };

  /**
   * Get the current audio system state
   * Useful for debugging and status checks
   */
  const getState = () => {
    if (audioManagerInstance) {
      return audioManagerInstance.getState();
    }
    return {
      initialized: false,
      processing: false,
      contextState: null,
      sampleRate: null
    };
  };

  /**
   * Clear the current error
   */
  const clearError = (): void => {
    currentError.value = null;
  };

  // Return reactive state and methods
  return {
    // State
    audioContext,
    selectedDevice,
    availableDevices,
    isInitialized,
    permissionGranted,
    currentError,
    
    // Methods
    requestPermission,
    enumerateDevices,
    selectDevice,
    initializeWorklet,
    startProcessing,
    stopProcessing,
    cleanup,
    onTickDetected,
    setCalibration,
    getState,
    clearError
  };
}
