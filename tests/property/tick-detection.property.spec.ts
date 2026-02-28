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
        fc.float({ min: 0.01, max: 0.5 }),
        fc.float({ min: 0.1, max: 2.0 }),
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
        fc.float({ min: 0.01, max: 0.5 }),
        fc.float({ min: 0.1, max: 2.0 }),
        (samples, threshold, sensitivity) => {
          if (samples.length === 0) {
            return true;
          }

          const maxAllowedRms = threshold * sensitivity * 0.9;
          const scale =
            calculateRMS(samples, samples.length) === 0
              ? 0
              : maxAllowedRms /
                calculateRMS(samples, samples.length);

          const scaled = new Float32Array(samples.length);

          for (let i = 0; i < samples.length; i += 1) {
            scaled[i] = samples[i] * scale;
          }

          const detected = detectTick(
            scaled,
            scaled.length,
            threshold,
            sensitivity,
          );

          expect(detected).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

