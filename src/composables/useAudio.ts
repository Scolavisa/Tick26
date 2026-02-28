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
import type { TickEvent } from '../types';

// Singleton state - shared across all component instances
let audioManagerInstance: AudioManager | null = null;
let isSharedStateInitialized = false;

// Shared reactive state
const audioContext: Ref<AudioContext | null> = ref(null);
const selectedDevice: Ref<string | null> = ref(null);
const availableDevices: Ref<MediaDeviceInfo[]> = ref([]);
const isInitialized: Ref<boolean> = ref(false);
const permissionGranted: Ref<boolean> = ref(false);

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
   * Validates: Requirement 8.1
   * 
   * @returns Promise<boolean> - true if permission granted, false otherwise
   */
  const requestPermission = async (): Promise<boolean> => {
    try {
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
          console.error('Microphone permission denied by user');
        } else {
          console.error('Failed to request microphone permission:', error.message);
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
   * Validates: Requirements 1.2, 1.5
   * 
   * @param deviceId - The device ID to select and activate
   */
  const selectDevice = async (deviceId: string): Promise<void> => {
    try {
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
      
      if (error instanceof Error) {
        throw new Error(`Failed to select device: ${error.message}`);
      }
      throw error;
    }
  };

  /**
   * Initialize the AudioWorklet processor
   * Must be called after device selection and before starting processing
   * 
   * @throws Error if initialization fails
   */
  const initializeWorklet = async (): Promise<void> => {
    try {
      const manager = getAudioManager();
      
      if (!isInitialized.value) {
        throw new Error('Audio system not initialized. Call selectDevice() first.');
      }
      
      // Load the AudioWorklet processor
      await manager.loadWorklet();
      
      // Load the WASM module
      await manager.loadWasm();
      
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
   * 
   * @throws Error if audio system is not fully initialized
   */
  const startProcessing = (): void => {
    const manager = getAudioManager();
    
    if (!isInitialized.value) {
      throw new Error('Audio system not initialized. Call selectDevice() first.');
    }
    
    manager.start();
  };

  /**
   * Stop audio processing
   * Stops capturing and processing audio but keeps resources allocated
   */
  const stopProcessing = (): void => {
    if (audioManagerInstance) {
      audioManagerInstance.stop();
    }
  };

  /**
   * Clean up all audio resources
   * Stops processing, closes streams, and releases AudioContext
   */
  const cleanup = (): void => {
    if (audioManagerInstance) {
      audioManagerInstance.cleanup();
      audioManagerInstance = null;
    }
    
    // Reset reactive state
    audioContext.value = null;
    isInitialized.value = false;
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

  // Return reactive state and methods
  return {
    // State
    audioContext,
    selectedDevice,
    availableDevices,
    isInitialized,
    permissionGranted,
    
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
    getState
  };
}
