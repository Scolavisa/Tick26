/**
 * Reference implementation of the tick detection math in TypeScript.
 * Mirrors the AssemblyScript implementation in assembly/tick-detector.ts.
 *
 * Validates: Requirements 4.1, 4.2
 */

/**
 * In-place first-order high-pass filter.
 * cutoff: cutoff frequency in Hz (default 500 Hz); pass 0 to bypass.
 */
export function applyHighPassFilter(
  samples: Float32Array,
  sampleCount: number,
  cutoff = 500.0
): void {
  if (sampleCount <= 0 || cutoff <= 0) {
    return;
  }

  const sampleRate = 48000.0;
  const rc = 1.0 / (2.0 * Math.PI * cutoff);
  const dt = 1.0 / sampleRate;
  const alpha = rc / (rc + dt);

  let xPrev = samples[0]!;
  let yPrev = 0.0;

  for (let i = 0; i < sampleCount; i += 1) {
    const x = samples[i]!;
    const y = alpha * (yPrev + x - xPrev);
    samples[i] = y;
    xPrev = x;
    yPrev = y;
  }
}

/**
 * In-place first-order low-pass filter.
 * cutoff: cutoff frequency in Hz; pass 0 to bypass (no filtering).
 */
export function applyLowPassFilter(
  samples: Float32Array,
  sampleCount: number,
  cutoff: number
): void {
  if (sampleCount <= 0 || cutoff <= 0) {
    return;
  }

  const sampleRate = 48000.0;
  const rc = 1.0 / (2.0 * Math.PI * cutoff);
  const dt = 1.0 / sampleRate;
  const alpha = dt / (rc + dt);

  let yPrev = samples[0]!;

  for (let i = 0; i < sampleCount; i += 1) {
    const x = samples[i]!;
    const y = alpha * x + (1.0 - alpha) * yPrev;
    samples[i] = y;
    yPrev = y;
  }
}

/**
 * Apply a band-pass filter by chaining a high-pass and a low-pass stage.
 * lowCutoff: high-pass edge in Hz (0 = no high-pass / bypass)
 * highCutoff: low-pass edge in Hz (0 = no low-pass / bypass)
 */
export function applyBandPassFilter(
  samples: Float32Array,
  sampleCount: number,
  lowCutoff: number,
  highCutoff: number
): void {
  applyHighPassFilter(samples, sampleCount, lowCutoff);
  applyLowPassFilter(samples, sampleCount, highCutoff);
}

/**
 * Compute RMS (Root Mean Square) amplitude.
 */
export function calculateRMS(
  samples: Float32Array,
  sampleCount: number
): number {
  if (sampleCount <= 0) {
    return 0.0;
  }

  let sumSquares = 0.0;

  for (let i = 0; i < sampleCount; i += 1) {
    const value = samples[i]!;
    sumSquares += value * value;
  }

  const meanSquares = sumSquares / sampleCount;
  return Math.sqrt(meanSquares);
}

/**
 * Threshold-based tick identification with sensitivity-based noise filtering.
 *
 * Applies a band-pass filter defined by lowCutoff (high-pass edge) and
 * highCutoff (low-pass edge) before computing RMS.  Pass 0 for either
 * cutoff to skip that filter stage.
 *
 * Returns true when a potential tick is detected.
 */
export function detectTick(
  samples: Float32Array,
  sampleCount: number,
  threshold: number,
  sensitivity: number,
  lowCutoff = 500.0,
  highCutoff = 0.0
): boolean {
  if (sampleCount <= 0) {
    return false;
  }

  let effectiveSensitivity = sensitivity;

  if (effectiveSensitivity < 0.1) {
    effectiveSensitivity = 0.1;
  } else if (effectiveSensitivity > 2.0) {
    effectiveSensitivity = 2.0;
  }

  applyBandPassFilter(samples, sampleCount, lowCutoff, highCutoff);

  const rms = calculateRMS(samples, sampleCount);
  const effectiveThreshold = threshold * effectiveSensitivity;

  return rms >= effectiveThreshold;
}

