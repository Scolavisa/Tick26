/**
 * Application-wide constants for Tick Tack Timer PWA
 */

import type { ClockSize } from './types';

/**
 * Debounce window in milliseconds per clock size.
 *
 * After a tick is detected the worklet ignores further detections for this
 * duration to prevent counting mechanical bounce / acoustic ringing of the
 * same tick multiple times.
 *
 * Values are deliberately larger than the current 50 ms default to cover the
 * longer resonance tail of real clock mechanisms.  They are still comfortably
 * shorter than the shortest inter-tick interval for each clock size:
 *
 *  - Small  (~5.5 Hz  → ~182 ms between ticks): 120 ms window
 *  - Medium (~2.5 Hz  → ~400 ms between ticks): 150 ms window
 *  - Large  (~0.75 Hz → ~1333 ms between ticks): 250 ms window
 */
export const DEBOUNCE_WINDOW_MS: Record<ClockSize, number> = {
  small: 120,
  medium: 150,
  large: 250
};
