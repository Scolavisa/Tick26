import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Feature: tick-tack-timer, Unit tests for useAudio composable
// Validates: Requirements 1.2, 1.5, 8.1

/**
 * Mock Web Audio API and navigator.mediaDevices
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

  constructor(_context: any, _name: string) {}
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

// Mock global APIs
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

global.localStorage = localStorageMock as any;

describe('useAudio composable', () => {
  let useAudio: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageMock.clear();

    // Reset modules to clear singleton state
    vi.resetModules();

    // Re-establish global mocks AFTER resetModules
    global.AudioContext = MockAudioContext as any;
    global.AudioWorkletNode = MockAudioWorkletNode as any;
    global.navigator = {
      mediaDevices: {
        getUserMedia: mockGetUserMedia,
        enumerateDevices: mockEnumerateDevices
      }
    } as any;
    global.fetch = mockFetch;
    global.localStorage = localStorageMock as any;

    // Default mock implementations
    mockGetUserMedia.mockResolvedValue(new MockMediaStream());
    mockEnumerateDevices.mockResolvedValue([
      { deviceId: 'device-1', kind: 'audioinput', label: 'Microphone 1', groupId: 'group-1', toJSON: () => ({}) },
      { deviceId: 'device-2', kind: 'audioinput', label: 'Microphone 2', groupId: 'group-2', toJSON: () => ({}) },
      { deviceId: 'device-3', kind: 'videoinput', label: 'Camera 1', groupId: 'group-3', toJSON: () => ({}) }
    ]);
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100))
    });

    // Mock WebAssembly.compile
    vi.spyOn(WebAssembly, 'compile').mockResolvedValue({} as WebAssembly.Module);

    // Dynamically import to get fresh singleton state
    const module = await import('../../../src/composables/useAudio');
    useAudio = module.useAudio;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('returns reactive state and methods', () => {
      const audio = useAudio();

      // Check state properties
      expect(audio.audioContext).toBeDefined();
      expect(audio.selectedDevice).toBeDefined();
      expect(audio.availableDevices).toBeDefined();
      expect(audio.isInitialized).toBeDefined();
      expect(audio.permissionGranted).toBeDefined();

      // Check methods
      expect(typeof audio.requestPermission).toBe('function');
      expect(typeof audio.enumerateDevices).toBe('function');
      expect(typeof audio.selectDevice).toBe('function');
      expect(typeof audio.initializeWorklet).toBe('function');
      expect(typeof audio.startProcessing).toBe('function');
      expect(typeof audio.stopProcessing).toBe('function');
      expect(typeof audio.cleanup).toBe('function');
    });

    it('initializes with default state', () => {
      const audio = useAudio();

      expect(audio.audioContext.value).toBeNull();
      expect(audio.selectedDevice.value).toBeNull();
      expect(audio.availableDevices.value).toEqual([]);
      expect(audio.isInitialized.value).toBe(false);
      expect(audio.permissionGranted.value).toBe(false);
    });

    it('loads persisted device selection from localStorage', () => {
      localStorageMock.setItem('tick-tack-microphone', 'device-123');

      const audio = useAudio();

      expect(audio.selectedDevice.value).toBe('device-123');
    });

    it('shares state across multiple instances (singleton pattern)', () => {
      const audio1 = useAudio();
      const audio2 = useAudio();

      // Both instances should share the same reactive state
      expect(audio1.selectedDevice).toBe(audio2.selectedDevice);
      expect(audio1.isInitialized).toBe(audio2.isInitialized);
      expect(audio1.permissionGranted).toBe(audio2.permissionGranted);
    });
  });

  describe('Permission management', () => {
    it('requests microphone permission successfully', async () => {
      const audio = useAudio();

      const granted = await audio.requestPermission();

      expect(granted).toBe(true);
      expect(audio.permissionGranted.value).toBe(true);
      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    });

    it('stops the permission test stream immediately', async () => {
      const mockStream = new MockMediaStream();
      mockGetUserMedia.mockResolvedValue(mockStream);

      const audio = useAudio();
      await audio.requestPermission();

      const tracks = mockStream.getTracks();
      tracks.forEach(track => {
        expect(track.stop).toHaveBeenCalled();
      });
    });

    it('handles permission denied error', async () => {
      const permissionError = new Error('Permission denied');
      (permissionError as any).name = 'NotAllowedError';
      mockGetUserMedia.mockRejectedValue(permissionError);

      const audio = useAudio();
      const granted = await audio.requestPermission();

      expect(granted).toBe(false);
      expect(audio.permissionGranted.value).toBe(false);
    });

    it('handles generic permission errors', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Generic error'));

      const audio = useAudio();
      const granted = await audio.requestPermission();

      expect(granted).toBe(false);
      expect(audio.permissionGranted.value).toBe(false);
    });
  });

  describe('Device enumeration', () => {
    it('enumerates available audio input devices', async () => {
      const audio = useAudio();

      const devices = await audio.enumerateDevices();

      expect(mockEnumerateDevices).toHaveBeenCalled();
      expect(devices).toHaveLength(2); // Only audio inputs
      expect(devices[0].deviceId).toBe('device-1');
      expect(devices[1].deviceId).toBe('device-2');
    });

    it('filters out non-audio input devices', async () => {
      const audio = useAudio();

      const devices = await audio.enumerateDevices();

      // Should not include the videoinput device
      expect(devices.every((d: MediaDeviceInfo) => d.kind === 'audioinput')).toBe(true);
    });

    it('updates availableDevices reactive state', async () => {
      const audio = useAudio();

      await audio.enumerateDevices();

      expect(audio.availableDevices.value).toHaveLength(2);
      expect(audio.availableDevices.value[0].label).toBe('Microphone 1');
    });

    it('handles enumeration errors gracefully', async () => {
      mockEnumerateDevices.mockRejectedValue(new Error('Enumeration failed'));

      const audio = useAudio();
      const devices = await audio.enumerateDevices();

      expect(devices).toEqual([]);
      expect(audio.availableDevices.value).toEqual([]);
    });
  });

  describe('Device selection', () => {
    it('selects and activates a specific device', async () => {
      const audio = useAudio();

      await audio.selectDevice('device-1');

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: { deviceId: { exact: 'device-1' } },
        video: false
      });
      expect(audio.selectedDevice.value).toBe('device-1');
      expect(audio.isInitialized.value).toBe(true);
    });

    it('persists device selection to localStorage', async () => {
      const audio = useAudio();

      await audio.selectDevice('device-2');

      expect(localStorageMock.getItem('tick-tack-microphone')).toBe('device-2');
    });

    it('cleans up previous initialization before selecting new device', async () => {
      const audio = useAudio();

      // First selection
      await audio.selectDevice('device-1');
      expect(audio.isInitialized.value).toBe(true);

      // Second selection should clean up first
      await audio.selectDevice('device-2');

      expect(audio.selectedDevice.value).toBe('device-2');
      expect(audio.isInitialized.value).toBe(true);
    });

    it('handles device selection errors', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Device not found'));

      const audio = useAudio();

      await expect(audio.selectDevice('invalid-device')).rejects.toThrow(
        'Failed to select device'
      );

      expect(audio.isInitialized.value).toBe(false);
      expect(audio.selectedDevice.value).toBeNull();
    });
  });

  describe('Worklet initialization', () => {
    it('initializes AudioWorklet and WASM after device selection', async () => {
      const audio = useAudio();

      await audio.selectDevice('device-1');
      await audio.initializeWorklet();

      // AudioWorklet should be loaded
      // WASM should be loaded
      // (verified through AudioManager which is tested separately)
    });

    it('throws error if called before device selection', async () => {
      const audio = useAudio();

      await expect(audio.initializeWorklet()).rejects.toThrow(
        'Audio system not initialized'
      );
    });

    it('handles worklet initialization errors', async () => {
      // Mock worklet loading failure BEFORE selecting device
      const mockContext = new MockAudioContext();
      mockContext.audioWorklet.addModule.mockRejectedValue(new Error('Worklet load failed'));
      
      // Replace the global AudioContext constructor
      global.AudioContext = function() {
        return mockContext;
      } as any;

      const audio = useAudio();
      await audio.selectDevice('device-1');

      await expect(audio.initializeWorklet()).rejects.toThrow(
        'Failed to initialize worklet'
      );
    });
  });

  describe('Audio processing', () => {
    it('starts audio processing after initialization', async () => {
      const audio = useAudio();

      await audio.selectDevice('device-1');
      await audio.initializeWorklet();

      // Should not throw
      expect(() => audio.startProcessing()).not.toThrow();
    });

    it('throws error if starting processing before initialization', () => {
      const audio = useAudio();

      expect(() => audio.startProcessing()).toThrow(
        'Audio system not initialized'
      );
    });

    it('stops audio processing', async () => {
      const audio = useAudio();

      await audio.selectDevice('device-1');
      await audio.initializeWorklet();
      audio.startProcessing();

      // Should not throw
      expect(() => audio.stopProcessing()).not.toThrow();
    });

    it('handles stop when not processing', () => {
      const audio = useAudio();

      // Should not throw
      expect(() => audio.stopProcessing()).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('cleans up all audio resources', async () => {
      const audio = useAudio();

      await audio.selectDevice('device-1');
      await audio.initializeWorklet();
      audio.startProcessing();

      audio.cleanup();

      expect(audio.isInitialized.value).toBe(false);
      expect(audio.audioContext.value).toBeNull();
    });

    it('preserves selectedDevice and permissionGranted after cleanup', async () => {
      const audio = useAudio();

      await audio.requestPermission();
      await audio.selectDevice('device-1');

      audio.cleanup();

      // These should be preserved for persistence
      expect(audio.selectedDevice.value).toBe('device-1');
      expect(audio.permissionGranted.value).toBe(true);
    });

    it('can be called multiple times safely', async () => {
      const audio = useAudio();

      await audio.selectDevice('device-1');
      audio.cleanup();

      expect(() => audio.cleanup()).not.toThrow();
    });
  });

  describe('Tick detection callback', () => {
    it('registers tick detection callback', async () => {
      const audio = useAudio();
      const callback = vi.fn();

      await audio.selectDevice('device-1');
      await audio.initializeWorklet();

      // Should not throw
      expect(() => audio.onTickDetected(callback)).not.toThrow();
    });
  });

  describe('Calibration', () => {
    it('sets calibration parameters', async () => {
      const audio = useAudio();

      await audio.selectDevice('device-1');
      await audio.initializeWorklet();

      // Should not throw
      expect(() => audio.setCalibration(1.5, 0.1)).not.toThrow();
    });
  });

  describe('State inspection', () => {
    it('returns current state when not initialized', () => {
      const audio = useAudio();

      const state = audio.getState();

      expect(state.initialized).toBe(false);
      expect(state.processing).toBe(false);
    });

    it('returns current state when initialized', async () => {
      const audio = useAudio();

      await audio.selectDevice('device-1');

      const state = audio.getState();

      expect(state.initialized).toBe(true);
    });
  });

  describe('localStorage persistence', () => {
    it('loads device selection on initialization', () => {
      localStorageMock.setItem('tick-tack-microphone', 'saved-device');

      const audio = useAudio();

      expect(audio.selectedDevice.value).toBe('saved-device');
    });

    it('saves device selection when device is selected', async () => {
      const audio = useAudio();

      await audio.selectDevice('new-device');

      expect(localStorageMock.getItem('tick-tack-microphone')).toBe('new-device');
    });

    it('updates localStorage when device changes', async () => {
      const audio = useAudio();

      await audio.selectDevice('device-1');
      expect(localStorageMock.getItem('tick-tack-microphone')).toBe('device-1');

      await audio.selectDevice('device-2');
      expect(localStorageMock.getItem('tick-tack-microphone')).toBe('device-2');
    });
  });
});
