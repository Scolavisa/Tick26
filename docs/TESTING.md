# Testing Guide

This document provides comprehensive testing instructions for Tick Tack Timer.

## Running Tests

### One-Time Test Run
To run all tests once and see the results:

```bash
yarn test:run
```

### Watch Mode (Recommended for Development)
To run tests in watch mode (automatically re-runs when files change):

```bash
yarn test
```

### With UI (Visual Test Runner)
To run tests with a visual interface:

```bash
yarn test:ui
```

Then open your browser to the URL shown (usually http://localhost:51204/__vitest__/)

### Coverage Report
To generate a test coverage report:

```bash
yarn coverage
```

## Test Organization

```
tests/
├── unit/
│   └── audio/
│       ├── tick-detector.spec.ts           # Unit tests for WASM tick detector (8 tests)
│       ├── tick-processor.worklet.spec.ts  # Unit tests for AudioWorklet processor (20 tests)
│       └── AudioManager.spec.ts            # Unit tests for AudioManager (46 tests)
└── property/
    ├── tick-detection.property.spec.ts     # Property tests for tick detection (2 tests)
    └── audio-manager.property.spec.ts      # Property tests for audio forwarding (4 tests)
```

## Test Coverage

### Task 2: WASM Tick Detector
- ✅ 8 unit tests for RMS calculation, high-pass filtering, and tick detection
- ✅ 2 property-based tests (Properties 10 & 11) - 100 iterations each

### Task 3: AudioWorklet Processor
- ✅ 20 unit tests covering:
  - Initialization and configuration
  - Message handling (setCalibration, setWasm)
  - Audio processing pipeline
  - Duplicate detection window (50ms)
  - Error handling

### Task 4: AudioManager
- ✅ 46 unit tests covering:
  - AudioContext initialization
  - Microphone access and permissions
  - AudioWorklet loading
  - WASM module loading and compilation
  - Calibration settings
  - Audio graph connection (start/stop)
  - Tick detection callbacks
  - Worklet message handling
  - Resource cleanup
- ✅ 4 property-based tests (Property 9) covering:
  - Audio sample forwarding to WASM module (100 iterations)
  - WASM module initialization before processing (50 iterations)
  - Audio graph connection stability (50 iterations)
  - Calibration propagation to worklet (50 iterations)

**Total: 80 tests, all passing**

## What Was Fixed in Task 2

### Issues Found and Resolved:

1. **Syntax Error** - Removed malformed comment `*** End Patch】}***/` from test file
2. **fast-check Constraints** - Fixed float constraints to use `Math.fround()` for 32-bit floats
3. **Test Signal Issues** - Updated tests to use high-frequency signals instead of DC signals:
   - DC signals (constant values) are correctly filtered out by the high-pass filter
   - Tests now use alternating signals (e.g., `[0.5, -0.5, 0.5, -0.5, ...]`) which pass through the filter

### Test Results:
✅ All 10 tests passing:
- 8 unit tests for tick detector functions
- 2 property-based tests validating Requirements 4.1 and 4.2

## Understanding the Tests

### Unit Tests
- Test specific scenarios with known inputs and expected outputs
- Validate RMS calculation, high-pass filtering, and tick detection logic
- Test edge cases like zero samples, sensitivity bounds, etc.

### Property-Based Tests
- Run 100 iterations with randomly generated inputs
- **Property 10**: Validates that samples exceeding threshold are identified as ticks
- **Property 11**: Validates that samples below threshold are filtered out

## Notes

- The high-pass filter (~500Hz cutoff) correctly removes DC (constant) signals
- Tests use alternating high-frequency signals to simulate actual tick sounds
- The WASM implementation in `assembly/tick-detector.ts` mirrors the TypeScript reference in `src/audio/tick-detector-math.ts`
