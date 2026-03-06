// Tick detection module implemented in AssemblyScript
// Validates: Requirements 4.1, 4.2, 4.5, 10.3
//
// Exports:
// - detectTick: main entry point for tick detection
// - calculateRMS: helper to compute RMS amplitude
// - applyHighPassFilter: in-place high-pass filter (parameterized cutoff)
// - applyLowPassFilter: in-place low-pass filter (parameterized cutoff)
// - applyBandPassFilter: in-place band-pass filter (HP then LP stage)

// Simple in-place first-order high-pass filter.
// Assumes a nominal sample rate of 48000 Hz, which is typical for Web Audio.
// Takes a pointer to float samples in memory.
// cutoff: cutoff frequency in Hz; pass 0.0 to bypass (no filtering).
export function applyHighPassFilter(
  samplesPtr: usize,
  sampleCount: i32,
  cutoff: f32
): void {
  if (sampleCount <= 0 || cutoff <= 0.0) {
    return;
  }

  // High-pass filter design:
  //   y[n] = alpha * (y[n - 1] + x[n] - x[n - 1])
  // with:
  //   alpha = rc / (rc + dt)
  // where:
  //   rc = 1 / (2 * PI * cutoff)
  //   dt = 1 / sampleRate
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

// Simple in-place first-order low-pass filter.
// Assumes a nominal sample rate of 48000 Hz, which is typical for Web Audio.
// Takes a pointer to float samples in memory.
// cutoff: cutoff frequency in Hz; pass 0.0 to bypass (no filtering).
export function applyLowPassFilter(
  samplesPtr: usize,
  sampleCount: i32,
  cutoff: f32
): void {
  if (sampleCount <= 0 || cutoff <= 0.0) {
    return;
  }

  // Low-pass filter design:
  //   y[n] = alpha * x[n] + (1 - alpha) * y[n - 1]
  // with:
  //   alpha = dt / (rc + dt)
  // where:
  //   rc = 1 / (2 * PI * cutoff)
  //   dt = 1 / sampleRate
  const sampleRate: f32 = 48000.0;
  const rc: f32 = 1.0 / (2.0 * Mathf.PI * cutoff);
  const dt: f32 = 1.0 / sampleRate;
  const alpha: f32 = dt / (rc + dt);

  let yPrev: f32 = load<f32>(samplesPtr);

  for (let i: i32 = 0; i < sampleCount; i++) {
    const offset = samplesPtr + (i << 2); // i * 4 bytes (f32)
    const x: f32 = load<f32>(offset);
    const y: f32 = alpha * x + (1.0 - alpha) * yPrev;
    store<f32>(offset, y);
    yPrev = y;
  }
}

// Apply a band-pass filter by chaining a high-pass and a low-pass stage.
// lowCutoff: high-pass edge in Hz (0 = no high-pass / bypass)
// highCutoff: low-pass edge in Hz (0 = no low-pass / bypass)
// Passing 0 for both cutoffs leaves the signal unchanged.
export function applyBandPassFilter(
  samplesPtr: usize,
  sampleCount: i32,
  lowCutoff: f32,
  highCutoff: f32
): void {
  applyHighPassFilter(samplesPtr, sampleCount, lowCutoff);
  applyLowPassFilter(samplesPtr, sampleCount, highCutoff);
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
// 1. Applies a band-pass filter to isolate tick frequencies
// 2. Computes RMS amplitude of the filtered signal
// 3. Compares RMS against threshold scaled by sensitivity
//
// Takes a pointer to float samples in memory.
//
// lowCutoff: high-pass edge in Hz (0 = no high-pass / bypass)
// highCutoff: low-pass edge in Hz (0 = no low-pass / bypass)
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
  sensitivity: f32,
  lowCutoff: f32,
  highCutoff: f32
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

  // Step 1: Apply band-pass filter to isolate tick frequencies.
  applyBandPassFilter(samplesPtr, sampleCount, lowCutoff, highCutoff);

  // Step 2: Compute RMS amplitude of filtered signal.
  const rms: f32 = calculateRMS(samplesPtr, sampleCount);

  // Step 3: Compare against calibrated threshold scaled by sensitivity.
  const effectiveThreshold: f32 = threshold * effectiveSensitivity;
  return rms >= effectiveThreshold;
}

