/**
 * Reference implementation of the tick detection math in TypeScript.
 * Mirrors the AssemblyScript implementation in assembly/tick-detector.ts.
 *
 * Validates: Requirements 4.1, 4.2
 */

/**
 * In-place first-order high-pass filter with ~500 Hz cutoff at 48 kHz.
 */
export function applyHighPassFilter(
  samples: Float32Array,
  sampleCount: number
): void {
  if (sampleCount <= 0) {
    return;
  }

  const cutoff = 500.0;
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
 * Returns true when a potential tick is detected.
 */
export function detectTick(
  samples: Float32Array,
  sampleCount: number,
  threshold: number,
  sensitivity: number
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

  applyHighPassFilter(samples, sampleCount);

  const rms = calculateRMS(samples, sampleCount);
  const effectiveThreshold = threshold * effectiveSensitivity;

  return rms >= effectiveThreshold;
}

