import { describe, expect, it } from 'vitest';
import {
  applyHighPassFilter,
  calculateRMS,
  detectTick,
} from '../../../src/audio/tick-detector-math';

// Feature: tick-tack-timer, Unit tests for WASM tick detector math

describe('tick-detector-math: calculateRMS', () => {
  it('returns 0 for all-zero samples', () => {
    const samples = new Float32Array(128);
    const rms = calculateRMS(samples, samples.length);

    expect(rms).toBe(0);
  });

  it('returns 1 for all-one samples', () => {
    const samples = new Float32Array(128).fill(1);
    const rms = calculateRMS(samples, samples.length);

    expect(rms).toBeCloseTo(1, 5);
  });

  it('handles positive and negative values symmetrically', () => {
    const samples = new Float32Array([1, -1, 1, -1]);
    const rms = calculateRMS(samples, samples.length);

    expect(rms).toBeCloseTo(1, 5);
  });
});

describe('tick-detector-math: applyHighPassFilter', () => {
  it('attenuates DC (constant) input towards zero', () => {
    const samples = new Float32Array(128).fill(0.5);

    applyHighPassFilter(samples, samples.length);

    // After filtering, samples should be significantly reduced in magnitude.
    const maxAbs = Math.max(...Array.from(samples, (v) => Math.abs(v)));

    expect(maxAbs).toBeLessThan(0.5);
  });

  it('preserves energy of high-frequency alternating signal more than DC', () => {
    const dc = new Float32Array(128).fill(0.5);
    const alt = new Float32Array(128);

    for (let i = 0; i < alt.length; i += 1) {
      alt[i] = i % 2 === 0 ? 0.5 : -0.5;
    }

    applyHighPassFilter(dc, dc.length);
    applyHighPassFilter(alt, alt.length);

    const dcRms = calculateRMS(dc, dc.length);
    const altRms = calculateRMS(alt, alt.length);

    expect(altRms).toBeGreaterThan(dcRms);
  });
});

describe('tick-detector-math: detectTick', () => {
  it('does not detect tick when signal is below threshold', () => {
    const samples = new Float32Array(128).fill(0.001);

    const detected = detectTick(samples, samples.length, 0.1, 1.0);

    expect(detected).toBe(false);
  });

  it('detects tick when RMS exceeds threshold * sensitivity', () => {
    const samples = new Float32Array(128).fill(0.5);

    const detected = detectTick(samples, samples.length, 0.05, 1.0);

    expect(detected).toBe(true);
  });

  it('is less sensitive when sensitivity is low', () => {
    const samples = new Float32Array(128).fill(0.1);

    const withHighSensitivity = detectTick(
      samples.slice(),
      samples.length,
      0.05,
      2.0,
    );
    const withLowSensitivity = detectTick(
      samples.slice(),
      samples.length,
      0.05,
      0.1,
    );

    expect(withHighSensitivity).toBe(true);
    expect(withLowSensitivity).toBe(false);
  });
}
*** End Patch】}***/
