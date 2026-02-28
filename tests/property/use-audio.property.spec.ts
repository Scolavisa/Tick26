import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { useAudio } from '../../src/composables/useAudio';

// Feature: tick-tack-timer, Property 1: Microphone selection activation
// Feature: tick-tack-timer, Property 2: External microphone enumeration
// Feature: tick-tack-timer, Property 3: Microphone selection persistence
// Validates: Requirements 1.2, 1.3, 1.5

/**
 * Mock Web Audio API and MediaDevices for property testing
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
const mockEnumerateDevices = vi.fn();
const mockFetch = vi.fn();

global.AudioContext = MockAudioContext as any;
global.AudioWorkletNode = MockAudioWorkletNode as any;
global.navigator = {
  mediaDevices: {
    getUserMedia: mockGetUserMedia,
    enumerateDevices: mockEnumerateDevices
  }
} as any;
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
});

describe('useAudio properties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();

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
    vi.restoreAllMocks();
  });

  it('Property 1: selected microphone becomes active audio source', async () => {
    // **Validates: Requirement 1.2**
    // This property verifies that for any audio input source selected by the user,
    // the system should activate that specific microphone device and make it the
    // active audio source.

    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary device IDs
        fc.string({ minLength: 1, maxLength: 50 }),
        async (deviceId) => {
          // Clear mocks before each property test iteration
          vi.clearAllMocks();
          
          const { selectDevice, isInitialized, selectedDevice, cleanup } = useAudio();

          // Select the device
          await selectDevice(deviceId);

          // Property: The device should be marked as selected
          expect(selectedDevice.value).toBe(deviceId);

          // Property: The audio system should be initialized
          expect(isInitialized.value).toBe(true);

          // Property: getUserMedia should have been called with the specific device
          // Note: AudioManager adds video: false to the constraints
          expect(mockGetUserMedia).toHaveBeenCalledWith({
            audio: { deviceId: { exact: deviceId } },
            video: false
          });

          // Cleanup for next iteration
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: connected external microphones are detected and listed', async () => {
    // **Validates: Requirement 1.3**
    // This property verifies that for any external microphone connected to the device,
    // the microphone selector should detect it and include it in the list of available
    // audio input devices.

    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary lists of audio devices with unique deviceIds
        fc.array(
          fc.record({
            deviceId: fc.string({ minLength: 1, maxLength: 50 }),
            label: fc.string({ minLength: 1, maxLength: 100 }),
            kind: fc.constant('audioinput' as MediaDeviceKind),
            groupId: fc.string()
          }),
          { minLength: 1, maxLength: 10 }
        ).map(devices => {
          // Ensure unique deviceIds by deduplicating
          const uniqueDevices = Array.from(
            new Map(devices.map(d => [d.deviceId, d])).values()
          );
          return uniqueDevices;
        }),
        async (devices) => {
          // Mock enumerateDevices to return our generated devices
          mockEnumerateDevices.mockResolvedValue(devices);

          const { enumerateDevices, availableDevices } = useAudio();

          // Enumerate devices
          const result = await enumerateDevices();

          // Property: All audio input devices should be returned
          expect(result).toHaveLength(devices.length);
          expect(availableDevices.value).toHaveLength(devices.length);

          // Property: Each device should be present in the result
          for (const device of devices) {
            const found = result.find(d => d.deviceId === device.deviceId);
            expect(found).toBeDefined();
            expect(found?.label).toBe(device.label);
            expect(found?.kind).toBe('audioinput');
          }

          // Property: The result should match the reactive state
          expect(availableDevices.value).toEqual(result);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2 (edge case): filters out non-audio-input devices', async () => {
    // **Validates: Requirement 1.3**
    // This property verifies that only audio input devices are included in the
    // enumeration, filtering out video inputs and audio outputs.

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            deviceId: fc.string({ minLength: 1, maxLength: 50 }),
            label: fc.string({ minLength: 1, maxLength: 100 }),
            kind: fc.constantFrom('audioinput', 'audiooutput', 'videoinput') as fc.Arbitrary<MediaDeviceKind>,
            groupId: fc.string()
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (devices) => {
          // Mock enumerateDevices to return mixed device types
          mockEnumerateDevices.mockResolvedValue(devices);

          const { enumerateDevices, availableDevices } = useAudio();

          // Enumerate devices
          const result = await enumerateDevices();

          // Property: Only audio input devices should be returned
          const expectedCount = devices.filter(d => d.kind === 'audioinput').length;
          expect(result).toHaveLength(expectedCount);
          expect(availableDevices.value).toHaveLength(expectedCount);

          // Property: All returned devices should be audio inputs
          for (const device of result) {
            expect(device.kind).toBe('audioinput');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3: microphone selection persists across app reloads', async () => {
    // **Validates: Requirement 1.5**
    // This property verifies that for any microphone device selection, saving the
    // selection and then reloading the application should restore the same device
    // as the active selection.

    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary device IDs
        fc.string({ minLength: 1, maxLength: 50 }),
        async (deviceId) => {
          // First instance - select device
          const instance1 = useAudio();
          await instance1.selectDevice(deviceId);

          // Property: Device should be saved to localStorage
          const savedDeviceId = localStorage.getItem('tick-tack-microphone');
          expect(savedDeviceId).toBe(deviceId);

          // Cleanup first instance
          instance1.cleanup();

          // Simulate app reload by creating a new instance
          // Clear the module cache to simulate a fresh load
          const instance2 = useAudio();

          // Property: The selected device should be restored from localStorage
          expect(instance2.selectedDevice.value).toBe(deviceId);

          // Cleanup second instance
          instance2.cleanup();

          // Clear localStorage for next iteration
          localStorage.clear();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3 (round-trip): save and load preserves device ID exactly', async () => {
    // **Validates: Requirement 1.5**
    // This property verifies the round-trip persistence: any device ID saved
    // should be loaded back with exactly the same value.

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (deviceId) => {
          const { selectDevice, selectedDevice, cleanup } = useAudio();

          // Select and save
          await selectDevice(deviceId);
          const saved = selectedDevice.value;

          // Property: Saved value should match input
          expect(saved).toBe(deviceId);

          // Simulate reload
          cleanup();
          const instance2 = useAudio();

          // Property: Loaded value should match saved value
          expect(instance2.selectedDevice.value).toBe(saved);

          // Cleanup
          instance2.cleanup();
          localStorage.clear();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1 (invariant): device selection is idempotent', async () => {
    // **Validates: Requirement 1.2**
    // This property verifies that selecting the same device multiple times
    // results in the same state as selecting it once.

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 2, max: 5 }),
        async (deviceId, iterations) => {
          const { selectDevice, selectedDevice, isInitialized, cleanup } = useAudio();

          // Select the device multiple times
          for (let i = 0; i < iterations; i++) {
            await selectDevice(deviceId);

            // Property: State should be consistent after each selection
            expect(selectedDevice.value).toBe(deviceId);
            expect(isInitialized.value).toBe(true);
          }

          // Property: Final state should be the same as after first selection
          expect(selectedDevice.value).toBe(deviceId);
          expect(isInitialized.value).toBe(true);

          // Cleanup
          cleanup();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 2 (invariant): enumeration is consistent', async () => {
    // **Validates: Requirement 1.3**
    // This property verifies that calling enumerateDevices multiple times
    // with the same underlying devices returns consistent results.

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            deviceId: fc.string({ minLength: 1, maxLength: 50 }),
            label: fc.string({ minLength: 1, maxLength: 100 }),
            kind: fc.constant('audioinput' as MediaDeviceKind),
            groupId: fc.string()
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.integer({ min: 2, max: 5 }),
        async (devices, iterations) => {
          // Mock enumerateDevices to return the same devices each time
          mockEnumerateDevices.mockResolvedValue(devices);

          const { enumerateDevices } = useAudio();

          const results: MediaDeviceInfo[][] = [];

          // Enumerate multiple times
          for (let i = 0; i < iterations; i++) {
            const result = await enumerateDevices();
            results.push(result);
          }

          // Property: All results should be identical
          for (let i = 1; i < results.length; i++) {
            expect(results[i]).toEqual(results[0]);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
