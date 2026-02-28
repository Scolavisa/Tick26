/**
 * Error handling utilities for Tick Tack Timer PWA
 * Validates: Requirements 14.4
 */

import { ErrorCode } from '../types';
import type { ErrorInfo } from '../types';

const ERROR_LOG_KEY = 'tick-tack-error-log';
const MAX_ERROR_LOG_SIZE = 50;

/**
 * Log an error to localStorage
 * Maintains a rolling log of the last 50 errors
 */
export function logError(errorInfo: ErrorInfo): void {
  try {
    // Log to console for immediate debugging
    console.error(`[${errorInfo.code}] ${errorInfo.message}`, {
      details: errorInfo.details,
      resolution: errorInfo.resolution,
      timestamp: new Date(errorInfo.timestamp).toISOString()
    });

    // Get existing error log
    const existingLog = getErrorLog();
    
    // Add new error to the beginning
    existingLog.unshift(errorInfo);
    
    // Keep only the last MAX_ERROR_LOG_SIZE errors
    const trimmedLog = existingLog.slice(0, MAX_ERROR_LOG_SIZE);
    
    // Save back to localStorage
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(trimmedLog));
  } catch (e) {
    // If localStorage fails, at least log to console
    console.error('Failed to save error to localStorage:', e);
  }
}

/**
 * Retrieve all logged errors from localStorage
 */
export function getErrorLog(): ErrorInfo[] {
  try {
    const logData = localStorage.getItem(ERROR_LOG_KEY);
    if (!logData) {
      return [];
    }
    return JSON.parse(logData) as ErrorInfo[];
  } catch (e) {
    console.error('Failed to retrieve error log:', e);
    return [];
  }
}

/**
 * Clear all logged errors from localStorage
 */
export function clearErrorLog(): void {
  try {
    localStorage.removeItem(ERROR_LOG_KEY);
  } catch (e) {
    console.error('Failed to clear error log:', e);
  }
}

/**
 * Export error log as JSON string for debugging
 */
export function exportErrorLog(): string {
  const log = getErrorLog();
  return JSON.stringify(log, null, 2);
}

/**
 * Create a standardized ErrorInfo object
 */
export function createError(
  code: ErrorCode,
  message: string,
  details: string,
  resolution: string[]
): ErrorInfo {
  return {
    code,
    message,
    details,
    resolution,
    timestamp: Date.now()
  };
}

/**
 * Predefined error messages for common error scenarios
 */
export const ErrorMessages = {
  [ErrorCode.MICROPHONE_PERMISSION_DENIED]: {
    message: 'Microphone Access Denied',
    details: 'The application needs microphone access to detect clock ticks.',
    resolution: [
      'Click the "Grant Permission" button to allow microphone access',
      'Check your browser settings to ensure microphone permissions are not blocked',
      'If using a browser extension that blocks permissions, disable it for this site'
    ]
  },
  [ErrorCode.MICROPHONE_ACCESS_FAILED]: {
    message: 'Microphone Access Failed',
    details: 'Unable to access the selected microphone device.',
    resolution: [
      'Check that your microphone is properly connected',
      'Ensure no other application is using the microphone',
      'Try selecting a different microphone in Settings',
      'Refresh the page and try again'
    ]
  },
  [ErrorCode.AUDIOWORKLET_INIT_FAILED]: {
    message: 'Audio Processing Not Supported',
    details: 'Your browser does not support the required audio processing features.',
    resolution: [
      'Update your browser to the latest version',
      'Use Chrome 66+, Edge 79+, or Safari 14.1+',
      'Check that your browser supports AudioWorklet'
    ]
  },
  [ErrorCode.WASM_LOAD_FAILED]: {
    message: 'Failed to Load Audio Processor',
    details: 'The audio processing module could not be loaded.',
    resolution: [
      'Check your internet connection',
      'Refresh the page to retry',
      'Clear your browser cache and try again'
    ]
  },
  [ErrorCode.CALIBRATION_TIMEOUT]: {
    message: 'Calibration Timeout',
    details: 'No clock ticks were detected within 30 seconds.',
    resolution: [
      'Move the microphone closer to the clock',
      'Ensure the clock is ticking audibly',
      'Check that the correct microphone is selected in Settings',
      'Increase the volume or sensitivity if available'
    ]
  },
  [ErrorCode.BROWSER_NOT_SUPPORTED]: {
    message: 'Browser Not Supported',
    details: 'Your browser does not support the required Web APIs.',
    resolution: [
      'Use a modern browser: Chrome, Edge, Safari, or Firefox',
      'Update your browser to the latest version',
      'Enable JavaScript if it is disabled'
    ]
  }
};

/**
 * Create an ErrorInfo object from a predefined error code
 */
export function createErrorFromCode(code: ErrorCode): ErrorInfo {
  const errorTemplate = ErrorMessages[code];
  return createError(
    code,
    errorTemplate.message,
    errorTemplate.details,
    errorTemplate.resolution
  );
}
