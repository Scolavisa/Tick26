import { describe, it } from 'vitest';
import fc from 'fast-check';
import {
  calculateRMS,
  detectTick,
} from '../../src/audio/tick-detector-math';

// Feature: tick-tack-timer, Property 10: Threshold-based tick identification
// Feature: tick-tack-timer, Property 11: Sensitivity-based noise filtering

describe('tick-detector-math properties', () => {
  it('Property 10: samples exceeding threshold are identified as ticks', () => {
    fc.assert(
      fc.property(
        fc.float32Array({
          minLength: 128,
          maxLength: 128,
          noNaN: true,
          noDefaultInfinity: true,
        }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(0.5) }),
        fc.float({ min: Math.fround(0.1), max: Math.fround(2.0) }),
        (samples, threshold, sensitivity) => {
          if (samples.length === 0) {
            return true;
          }

          const rms = calculateRMS(samples, samples.length);
          const effectiveThreshold = threshold * sensitivity;

          if (rms > effectiveThreshold) {
            const detected = detectTick(
              samples.slice(),
              samples.length,
              threshold,
              sensitivity,
            );

            expect(detected).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 11: samples below sensitivity threshold are filtered out', () => {
    fc.assert(
      fc.property(
        fc.float32Array({
          minLength: 128,
          maxLength: 128,
          noNaN: true,
          noDefaultInfinity: true,
        }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(0.5) }),
        fc.float({ min: Math.fround(0.1), max: Math.fround(2.0) }),
        (samples, threshold, sensitivity) => {
          if (samples.length === 0) {
            return true;
          }

          // Create a copy for filtering to measure post-filter RMS
          const testSamples = samples.slice();
          
          // Apply the same filtering that detectTick does
          const cutoff = 500.0;
          const sampleRate = 48000.0;
          const rc = 1.0 / (2.0 * Math.PI * cutoff);
          const dt = 1.0 / sampleRate;
          const alpha = rc / (rc + dt);

          let xPrev = testSamples[0];
          let yPrev = 0.0;

          for (let i = 0; i < testSamples.length; i++) {
            const x = testSamples[i];
            const y = alpha * (yPrev + x - xPrev);
            testSamples[i] = y;
            xPrev = x;
            yPrev = y;
          }

          // Calculate RMS of filtered signal
          const rms = calculateRMS(testSamples, testSamples.length);
          const effectiveThreshold = threshold * sensitivity;

          // If the filtered RMS is below threshold, detection should be false
          if (rms < effectiveThreshold * 0.9) {
            const detected = detectTick(
              samples.slice(),
              samples.length,
              threshold,
              sensitivity,
            );

            expect(detected).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

