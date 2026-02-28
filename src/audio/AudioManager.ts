/**
 * AudioManager - Coordinates audio system initialization and communication
 * Validates: Requirements 3.1, 3.2, 3.3, 8.3
 * 
 * This class manages:
 * - Web Audio API initialization (AudioContext)
 * - Microphone access and MediaStream management
 * - AudioWorklet processor loading and lifecycle
 * - WASM module loading and instantiation
 * - Audio graph connection: MediaStream → AudioWorklet
 * - Tick detection event forwarding to application layer
 * - Resource cleanup and disposal
 */

import type { TickEvent } from '../types';

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private wasmModule: WebAssembly.Module | null = null;
  private tickCallback: ((event: TickEvent) => void) | null = null;
  private isProcessing = false;

  /**
   * Initialize the audio system
   * Creates AudioContext and requests microphone access
   * 
   * @param deviceId - Optional specific microphone device ID
   * @throws Error if microphone access is denied or AudioContext creation fails
   */
  async initialize(deviceId?: string): Promise<void> {
    try {
      // Create AudioContext if not already created
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      // Resume AudioContext if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Request microphone access
      const constraints: MediaStreamConstraints = {
        audio: deviceId
          ? { deviceId: { exact: deviceId } }
          : true,
        video: false
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create MediaStreamAudioSourceNode from the microphone stream
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

    } catch (error) {
      // Clean up on error
      this.cleanup();
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          throw new Error('Microphone permission denied');
        } else if (error.name === 'NotFoundError') {
          throw new Error('Microphone device not found');
        } else {
          throw new Error(`Failed to initialize audio: ${error.message}`);
        }
      }
      throw error;
    }
  }

  /**
   * Load the AudioWorklet processor script
   * Must be called after initialize() and before start()
   * 
   * @throws Error if AudioWorklet loading fails
   */
  async loadWorklet(): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized. Call initialize() first.');
    }

    try {
      // Load the AudioWorklet processor module
      // The path is relative to the public directory
      await this.audioContext.audioWorklet.addModule('/tick-processor.worklet.js');

      // Create the AudioWorkletNode
      this.workletNode = new AudioWorkletNode(
        this.audioContext,
        'tick-processor'
      );

      // Set up message handler for worklet messages
      this.workletNode.port.onmessage = (event) => {
        this.handleWorkletMessage(event.data);
      };

    } catch (error) {
      throw new Error(
        `Failed to load AudioWorklet: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Load and compile the WASM module
   * Must be called after initialize()
   * 
   * @returns The compiled WASM module
   * @throws Error if WASM loading or compilation fails
   */
  async loadWasm(): Promise<WebAssembly.Module> {
    try {
      // Fetch the WASM module from the public directory
      const response = await fetch('/tick-detector.wasm');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM module: ${response.statusText}`);
      }

      // Get the WASM binary
      const wasmBinary = await response.arrayBuffer();

      // Compile the WASM module
      this.wasmModule = await WebAssembly.compile(wasmBinary);

      // Send the compiled module to the worklet
      if (this.workletNode) {
        this.workletNode.port.postMessage({
          type: 'setWasm',
          wasmModule: this.wasmModule
        });
      }

      return this.wasmModule;

    } catch (error) {
      throw new Error(
        `Failed to load WASM module: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set calibration parameters for tick detection
   * Sends sensitivity and threshold values to the AudioWorklet processor
   * 
   * @param sensitivity - Sensitivity multiplier (0.1 - 2.0)
   * @param threshold - RMS amplitude threshold (0.01 - 0.5)
   */
  setCalibration(sensitivity: number, threshold: number): void {
    if (!this.workletNode) {
      console.warn('AudioManager: Cannot set calibration, worklet not loaded');
      return;
    }

    // Send calibration settings to the worklet
    this.workletNode.port.postMessage({
      type: 'setCalibration',
      sensitivity,
      threshold
    });
  }

  /**
   * Start audio processing
   * Connects the audio graph: MediaStream → AudioWorklet → Destination
   * 
   * @throws Error if audio system is not fully initialized
   */
  start(): void {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized. Call initialize() first.');
    }

    if (!this.sourceNode) {
      throw new Error('MediaStream source not created. Call initialize() first.');
    }

    if (!this.workletNode) {
      throw new Error('AudioWorklet not loaded. Call loadWorklet() first.');
    }

    if (this.isProcessing) {
      console.warn('AudioManager: Already processing audio');
      return;
    }

    // Connect the audio graph
    // MediaStream → AudioWorklet → Destination (for monitoring, optional)
    this.sourceNode.connect(this.workletNode);
    // Note: We don't connect to destination to avoid audio feedback
    // The worklet processes audio but doesn't output it

    this.isProcessing = true;
  }

  /**
   * Stop audio processing
   * Disconnects the audio graph but keeps resources allocated
   */
  stop(): void {
    if (!this.isProcessing) {
      return;
    }

    // Disconnect the audio graph
    if (this.sourceNode && this.workletNode) {
      this.sourceNode.disconnect(this.workletNode);
    }

    this.isProcessing = false;
  }

  /**
   * Register a callback for tick detection events
   * The callback will be invoked whenever the worklet detects a tick
   * 
   * @param callback - Function to call when a tick is detected
   */
  onTickDetected(callback: (event: TickEvent) => void): void {
    this.tickCallback = callback;
  }

  /**
   * Clean up all audio resources
   * Stops processing, closes streams, and releases AudioContext
   */
  cleanup(): void {
    // Stop processing if active
    this.stop();

    // Disconnect and clean up worklet node
    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    // Disconnect and clean up source node
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    // Stop and clean up media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Clear callback
    this.tickCallback = null;
    this.wasmModule = null;
    this.isProcessing = false;
  }

  /**
   * Handle messages from the AudioWorklet processor
   * 
   * @param data - Message data from the worklet
   */
  private handleWorkletMessage(data: any): void {
    switch (data.type) {
      case 'ready':
        console.log('AudioManager: Worklet ready');
        break;

      case 'wasmReady':
        console.log('AudioManager: WASM module initialized in worklet');
        break;

      case 'calibrationSet':
        console.log('AudioManager: Calibration updated', {
          sensitivity: data.sensitivity,
          threshold: data.threshold
        });
        break;

      case 'tickDetected':
        // Forward tick detection event to the application layer
        if (this.tickCallback) {
          const tickEvent: TickEvent = {
            timestamp: data.timestamp,
            amplitude: data.amplitude,
            confidence: data.confidence
          };
          this.tickCallback(tickEvent);
        }
        break;

      case 'error':
        console.error('AudioManager: Worklet error', {
          error: data.error,
          details: data.details
        });
        break;

      default:
        console.warn('AudioManager: Unknown worklet message type', data.type);
    }
  }

  /**
   * Get the current AudioContext state
   * Useful for debugging and status checks
   */
  getState(): {
    initialized: boolean;
    processing: boolean;
    contextState: AudioContextState | null;
    sampleRate: number | null;
  } {
    return {
      initialized: this.audioContext !== null,
      processing: this.isProcessing,
      contextState: this.audioContext?.state || null,
      sampleRate: this.audioContext?.sampleRate || null
    };
  }
}
