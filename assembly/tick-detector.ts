// Tick detection module implemented in AssemblyScript
// Validates: Requirements 4.1, 4.2, 4.5, 10.3
//
// Exports:
// - detectTick: main entry point for tick detection
// - calculateRMS: helper to compute RMS amplitude
// - applyHighPassFilter: in-place high-pass filter (~500 Hz cutoff)

// Simple in-place first-order high-pass filter.
// Assumes a nominal sample rate of 48000 Hz, which is typical for Web Audio.
// Takes a pointer to float samples in memory
export function applyHighPassFilter(
  samplesPtr: usize,
  sampleCount: i32
): void {
  if (sampleCount <= 0) {
    return;
  }

  // High-pass filter design:
  //   y[n] = alpha * (y[n - 1] + x[n] - x[n - 1])
  // with:
  //   alpha = rc / (rc + dt)
  // where:
  //   rc = 1 / (2 * PI * cutoff)
  //   dt = 1 / sampleRate
  const cutoff: f32 = 500.0;
  const sampleRate: f32 = 48000.0;
  const rc: f32 = 1.0 / (2.0 * Mathf.PI * cutoff);
  const dt: f32 = 1.0 / sampleRate;
  const alpha: f32 = rc / (rc + dt);

  let xPrev: f32 = load<f32>(samplesPtr);
  let yPrev: f32 = 0.0;

  for (let i: i32 = 0; i < sampleCount; i++) {
    const offset = samplesPtr + (i << 2); // i * 4 bytes (f32)
    const x: f32 = load<f32>(offset);
    const y: f32 = alpha * (yPrev + x - xPrev);
    store<f32>(offset, y);
    xPrev = x;
    yPrev = y;
  }
}

// Compute RMS (Root Mean Square) amplitude for the given samples.
// Takes a pointer to float samples in memory
export function calculateRMS(
  samplesPtr: usize,
  sampleCount: i32
): f32 {
  if (sampleCount <= 0) {
    return 0.0;
  }

  let sumSquares: f32 = 0.0;
  for (let i: i32 = 0; i < sampleCount; i++) {
    const offset = samplesPtr + (i << 2); // i * 4 bytes (f32)
    const value: f32 = load<f32>(offset);
    sumSquares += value * value;
  }

  const meanSquares: f32 = sumSquares / <f32>sampleCount;
  return Mathf.sqrt(meanSquares);
}

// Main entry point used by the AudioWorklet to determine if a tick occurred.
//
// The function:
// 1. Applies a high-pass filter to isolate tick frequencies
// 2. Computes RMS amplitude of the filtered signal
// 3. Compares RMS against threshold scaled by sensitivity
//
// Takes a pointer to float samples in memory
//
// Returns:
// - true when a potential Tick_Event is detected
// - false otherwise
//
// Validates:
// - Requirement 4.1: Threshold-based tick identification
// - Requirement 4.2: Sensitivity-based noise filtering
export function detectTick(
  samplesPtr: usize,
  sampleCount: i32,
  threshold: f32,
  sensitivity: f32
): bool {
  if (sampleCount <= 0) {
    return false;
  }

  // Defensive bounds for sensitivity to avoid degenerate configurations.
  let effectiveSensitivity: f32 = sensitivity;
  if (effectiveSensitivity < 0.1) {
    effectiveSensitivity = 0.1;
  } else if (effectiveSensitivity > 2.0) {
    effectiveSensitivity = 2.0;
  }

  // Step 1: Filter low-frequency components.
  applyHighPassFilter(samplesPtr, sampleCount);

  // Step 2: Compute RMS amplitude of filtered signal.
  const rms: f32 = calculateRMS(samplesPtr, sampleCount);

  // Step 3: Compare against calibrated threshold scaled by sensitivity.
  const effectiveThreshold: f32 = threshold * effectiveSensitivity;
  return rms >= effectiveThreshold;
}

