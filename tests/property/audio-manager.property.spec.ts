import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { AudioManager } from '../../src/audio/AudioManager';

// Feature: tick-tack-timer, Property 9: Audio sample forwarding
// Validates: Requirements 3.3

/**
 * Mock Web Audio API components for property testing
 */
class MockAudioContext {
  state: AudioContextState = 'running';
  sampleRate = 48000;
  audioWorklet = {
    addModule: vi.fn().mockResolvedValue(undefined)
  };

  createMediaStreamSource = vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn()
  });

  createGain = vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1.0 }
  });

  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
}

class MockAudioWorkletNode {
  port = {
    postMessage: vi.fn(),
    onmessage: null as ((event: MessageEvent) => void) | null
  };

  connect = vi.fn();
  disconnect = vi.fn();

  constructor(context: AudioContext, name: string) {}
}

class MockMediaStream {
  private tracks: MediaStreamTrack[] = [
    {
      stop: vi.fn(),
      kind: 'audio',
      id: 'mock-track-1',
      label: 'Mock Audio Track',
      enabled: true,
      muted: false,
      readyState: 'live'
    } as any
  ];

  getTracks() {
    return this.tracks;
  }
}

// Set up global mocks
const mockGetUserMedia = vi.fn();
const mockFetch = vi.fn();

global.AudioContext = MockAudioContext as any;
global.AudioWorkletNode = MockAudioWorkletNode as any;
global.navigator = {
  mediaDevices: {
    getUserMedia: mockGetUserMedia
  }
} as any;
global.fetch = mockFetch;

describe('AudioManager properties', () => {
  let audioManager: AudioManager;

  beforeEach(() => {
    audioManager = new AudioManager();
    vi.clearAllMocks();

    // Default mock implementations
    mockGetUserMedia.mockResolvedValue(new MockMediaStream());
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100))
    });

    // Mock WebAssembly.compile
    vi.spyOn(WebAssembly, 'compile').mockResolvedValue({} as WebAssembly.Module);
  });

  afterEach(() => {
    audioManager.cleanup();
    vi.restoreAllMocks();
  });

  it('Property 9: audio samples are passed to WASM module', async () => {
    // This property verifies that for any audio samples received by the audio processor,
    // those samples should be passed to the WASM tick detector module for analysis.
    //
    // Since the actual audio processing happens in the AudioWorklet (which runs in a
    // separate thread), we test this property by verifying that:
    // 1. The AudioManager correctly initializes and connects the audio graph
    // 2. The WASM module is loaded and sent to the worklet
    // 3. The worklet is properly connected to receive audio samples
    //
    // The actual sample forwarding is tested in the AudioWorklet processor tests.

    await fc.assert(
      fc.asyncProperty(
        // Generate random calibration settings
        fc.float({ min: Math.fround(0.1), max: Math.fround(2.0) }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(0.5) }),
        async (sensitivity, threshold) => {
          // Initialize the audio system
          await audioManager.initialize();
          await audioManager.loadWorklet();
          await audioManager.loadWasm();

          // Set calibration parameters
          audioManager.setCalibration(sensitivity, threshold, 500, 8000);

          // Start audio processing
          audioManager.start();

          // Verify the audio graph is connected
          const sourceNode = (audioManager as any).sourceNode;
          const gainNode = (audioManager as any).gainNode;
          const workletNode = (audioManager as any).workletNode;

          // Property: The source node should be connected to the gain node, and gain to worklet
          expect(sourceNode).not.toBeNull();
          expect(gainNode).not.toBeNull();
          expect(workletNode).not.toBeNull();
          expect(sourceNode.connect).toHaveBeenCalledWith(gainNode);
          expect(gainNode.connect).toHaveBeenCalledWith(workletNode);

          // Property: The WASM module should have been sent to the worklet
          expect(workletNode.port.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'setWasm',
              wasmBinary: expect.any(ArrayBuffer)
            })
          );

          // Property: Calibration settings should have been sent to the worklet
          expect(workletNode.port.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'setCalibration',
              sensitivity,
              threshold,
              lowCutoff: 500,
              highCutoff: 8000
            })
          );

          // Property: The audio processing state should be active
          const state = audioManager.getState();
          expect(state.processing).toBe(true);

          // Cleanup for next iteration
          audioManager.cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9 (extended): worklet receives WASM module before processing starts', async () => {
    // This property verifies that the WASM module is always sent to the worklet
    // before audio processing begins, ensuring samples can be analyzed.

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('device-1', 'device-2', 'default'),
        async (deviceId) => {
          // Initialize with specific device
          await audioManager.initialize(deviceId === 'default' ? undefined : deviceId);
          await audioManager.loadWorklet();
          await audioManager.loadWasm();

          const workletNode = (audioManager as any).workletNode;
          const wasmModule = (audioManager as any).wasmModule;

          // Property: WASM module should be loaded
          expect(wasmModule).not.toBeNull();

          // Property: WASM binary should have been sent to worklet
          expect(workletNode.port.postMessage).toHaveBeenCalledWith({
            type: 'setWasm',
            wasmBinary: expect.any(ArrayBuffer)
          });

          // Now start processing
          audioManager.start();

          // Property: Processing should be active
          const state = audioManager.getState();
          expect(state.processing).toBe(true);

          // Cleanup
          audioManager.cleanup();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 9 (edge case): audio graph remains connected during processing', async () => {
    // This property verifies that once audio processing starts, the audio graph
    // remains connected until explicitly stopped, ensuring continuous sample forwarding.

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (iterations) => {
          await audioManager.initialize();
          await audioManager.loadWorklet();
          await audioManager.loadWasm();

          audioManager.start();

          const sourceNode = (audioManager as any).sourceNode;
          const gainNode = (audioManager as any).gainNode;
          const workletNode = (audioManager as any).workletNode;

          // Clear the initial connect call
          vi.clearAllMocks();

          // Simulate multiple processing cycles
          for (let i = 0; i < iterations; i++) {
            // Property: The connection should remain stable
            const state = audioManager.getState();
            expect(state.processing).toBe(true);

            // Property: No additional connect calls should be made
            expect(sourceNode.connect).not.toHaveBeenCalled();
          }

          // Stop processing
          audioManager.stop();

          // Property: Disconnect should be called exactly once (source from gain)
          expect(sourceNode.disconnect).toHaveBeenCalledTimes(1);
          expect(sourceNode.disconnect).toHaveBeenCalledWith(gainNode);
          // gainNode→worklet connection is preserved (not disconnected on stop)
          expect(gainNode.disconnect).not.toHaveBeenCalled();

          // Cleanup
          audioManager.cleanup();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 9 (invariant): calibration changes propagate to worklet', async () => {
    // This property verifies that any calibration changes are forwarded to the
    // worklet, ensuring the WASM module receives updated parameters for sample analysis.

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            sensitivity: fc.float({ min: Math.fround(0.1), max: Math.fround(2.0) }),
            threshold: fc.float({ min: Math.fround(0.01), max: Math.fround(0.5) })
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (calibrations) => {
          await audioManager.initialize();
          await audioManager.loadWorklet();
          await audioManager.loadWasm();

          const workletNode = (audioManager as any).workletNode;
          vi.clearAllMocks();

          // Apply each calibration
          for (const cal of calibrations) {
            audioManager.setCalibration(cal.sensitivity, cal.threshold, 500, 8000);

            // Property: Each calibration should be sent to the worklet
            expect(workletNode.port.postMessage).toHaveBeenCalledWith({
              type: 'setCalibration',
              sensitivity: cal.sensitivity,
              threshold: cal.threshold,
              lowCutoff: 500,
              highCutoff: 8000
            });

            vi.clearAllMocks();
          }

          // Cleanup
          audioManager.cleanup();
        }
      ),
      { numRuns: 50 }
    );
  });
});
