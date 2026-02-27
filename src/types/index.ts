/**
 * Type definitions for Tick Tack Timer PWA
 * Validates: Requirements 10.4
 */

/**
 * Clock size classification indicating tick frequency
 */
export type ClockSize = 'small' | 'medium' | 'large';

/**
 * Error codes for structured error handling
 */
export const ErrorCode = {
  MICROPHONE_PERMISSION_DENIED: 'MIC_PERMISSION_DENIED',
  MICROPHONE_ACCESS_FAILED: 'MIC_ACCESS_FAILED',
  AUDIOWORKLET_INIT_FAILED: 'WORKLET_INIT_FAILED',
  WASM_LOAD_FAILED: 'WASM_LOAD_FAILED',
  CALIBRATION_TIMEOUT: 'CALIBRATION_TIMEOUT',
  BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED'
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

/**
 * Calibration parameters for tick detection
 * Storage: localStorage key 'tick-tack-calibration'
 */
export interface CalibrationSettings {
  clockSize: ClockSize;
  sensitivity: number;        // Range: 0.1 - 2.0
  threshold: number;          // Range: 0.01 - 0.5 (RMS amplitude)
  expectedFrequency: number;  // Expected ticks per second
  calibratedAt: number;       // Timestamp of calibration
}

/**
 * Measurement session information
 * Storage: localStorage key 'tick-tack-session'
 */
export interface SessionData {
  id: string;                 // UUID
  startTime: number;          // Unix timestamp
  endTime: number | null;     // Unix timestamp or null if active
  tickCount: number;          // Total ticks detected
  duration: number;           // Duration in seconds
  clockSize: ClockSize;       // Clock size used
  microphone: string;         // Device ID or 'internal'
}

/**
 * Available audio input device information
 * Derived from MediaDeviceInfo Web API
 */
export interface AudioDeviceInfo {
  deviceId: string;           // Unique device identifier
  label: string;              // Human-readable device name
  kind: 'audioinput';         // MediaDeviceInfo kind
  isDefault: boolean;         // System default device flag
  isExternal: boolean;        // USB-C contact microphone flag
}

/**
 * Detected tick event
 * Usage: Internal to AudioWorklet, not persisted
 */
export interface TickEvent {
  timestamp: number;          // High-resolution timestamp (performance.now())
  amplitude: number;          // RMS amplitude of detected tick
  confidence: number;         // Detection confidence (0-1)
}

/**
 * Global application state
 * Storage: Combination of reactive refs in composables and localStorage
 */
export interface AppState {
  // Audio state
  audioInitialized: boolean;
  permissionGranted: boolean;
  selectedDeviceId: string | null;
  
  // Calibration state
  calibrationSettings: CalibrationSettings | null;
  isCalibrated: boolean;
  
  // Session state
  currentSession: SessionData | null;
  isSessionActive: boolean;
  
  // UI state
  currentPage: 'settings' | 'calibration' | 'measurement';
  errorMessage: string | null;
}

/**
 * Structured error information for user display
 */
export interface ErrorInfo {
  code: ErrorCode;
  message: string;
  details: string;
  resolution: string[];       // Steps to resolve
  timestamp: number;
}
