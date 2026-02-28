// AudioWorklet processor for real-time tick detection
// Validates: Requirements 3.1, 3.2, 3.3, 4.3, 4.4
//
// This processor runs in a dedicated audio thread and:
// - Receives 128-sample audio blocks from the Web Audio API
// - Passes samples to the WASM tick detector
// - Implements 50ms duplicate detection window
// - Posts tick detection messages to the main thread
// - Maintains latency below 100ms

class TickProcessorWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    
    // WASM instance for tick detection
    this.wasmInstance = null;
    this.wasmMemory = null;
    this.wasmExports = null;
    
    // Calibration parameters
    this.sensitivity = 1.0;
    this.threshold = 0.08;
    
    // Duplicate detection window (50ms)
    // At 48kHz sample rate, 50ms = 2400 samples
    // We track the last tick time in samples
    this.lastTickTime = -Infinity;
    this.duplicateWindowSamples = 2400; // 50ms at 48kHz
    this.currentSampleTime = 0;
    
    // Sample rate (will be set from context)
    this.sampleRate = sampleRate || 48000;
    
    // Update duplicate window based on actual sample rate
    this.duplicateWindowSamples = Math.floor(this.sampleRate * 0.05); // 50ms
    
    // Message handler for communication with main thread
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    
    // Notify main thread that worklet is ready
    this.port.postMessage({ type: 'ready' });
  }
  
  /**
   * Handle messages from the main thread
   * @param {Object} data - Message data
   */
  handleMessage(data) {
    switch (data.type) {
      case 'setCalibration':
        this.handleSetCalibration(data);
        break;
      case 'setWasm':
        this.handleSetWasm(data);
        break;
      default:
        console.warn('TickProcessorWorklet: Unknown message type:', data.type);
    }
  }
  
  /**
   * Handle calibration settings update
   * @param {Object} data - Calibration data with sensitivity and threshold
   */
  handleSetCalibration(data) {
    if (typeof data.sensitivity === 'number') {
      this.sensitivity = data.sensitivity;
    }
    if (typeof data.threshold === 'number') {
      this.threshold = data.threshold;
    }
    
    // Acknowledge calibration update
    this.port.postMessage({
      type: 'calibrationSet',
      sensitivity: this.sensitivity,
      threshold: this.threshold
    });
  }
  
  /**
   * Handle WASM module initialization
   * @param {Object} data - WASM module data
   */
  handleSetWasm(data) {
    try {
      // The main thread sends us the compiled WASM module
      if (data.wasmModule) {
        // Instantiate the WASM module
        const wasmModule = data.wasmModule;
        
        // Create memory for WASM (1 page = 64KB, enough for audio samples)
        this.wasmMemory = new WebAssembly.Memory({ initial: 10 });
        
        // Instantiate with memory
        const instance = new WebAssembly.Instance(wasmModule, {
          env: {
            memory: this.wasmMemory,
            abort: (msg, file, line, column) => {
              console.error('WASM abort:', msg, file, line, column);
            }
          }
        });
        
        this.wasmInstance = instance;
        this.wasmExports = instance.exports;
        
        // Acknowledge WASM initialization
        this.port.postMessage({ type: 'wasmReady' });
      }
    } catch (error) {
      console.error('TickProcessorWorklet: Failed to initialize WASM:', error);
      this.port.postMessage({
        type: 'error',
        error: 'Failed to initialize WASM module',
        details: error.message
      });
    }
  }
  
  /**
   * Process audio samples
   * This is called by the Web Audio API for each 128-sample block
   * 
   * @param {Float32Array[][]} inputs - Input audio data
   * @param {Float32Array[][]} outputs - Output audio data (unused)
   * @param {Object} parameters - Audio parameters (unused)
   * @returns {boolean} - true to keep processor alive
   */
  process(inputs, outputs, parameters) {
    // Check if we have WASM initialized
    if (!this.wasmInstance || !this.wasmExports) {
      // Not ready yet, keep processor alive
      return true;
    }
    
    // Get the first input channel (mono)
    const input = inputs[0];
    if (!input || input.length === 0) {
      // No input, keep processor alive
      return true;
    }
    
    const samples = input[0]; // First channel
    if (!samples || samples.length === 0) {
      // No samples, keep processor alive
      return true;
    }
    
    const sampleCount = samples.length;
    
    try {
      // Copy samples to WASM memory
      // WASM functions expect memory offsets (pointers), not JS typed arrays
      const wasmMemoryBuffer = this.wasmMemory.buffer;
      
      // Allocate space in WASM memory for samples
      // We'll use a fixed offset for simplicity
      // Float32 = 4 bytes, so we need sampleCount * 4 bytes
      const samplesOffset = 0;
      const wasmSamples = new Float32Array(
        wasmMemoryBuffer,
        samplesOffset,
        sampleCount
      );
      
      // Copy input samples to WASM memory
      wasmSamples.set(samples);
      
      // Debug: Calculate RMS before filtering to see if we're getting audio
      let sumSquares = 0;
      for (let i = 0; i < sampleCount; i++) {
        sumSquares += samples[i] * samples[i];
      }
      const inputRMS = Math.sqrt(sumSquares / sampleCount);
      
      // Log every 100 blocks (about once per second at 48kHz)
      if (this.currentSampleTime % 12800 < 128) {
        console.log('AudioWorklet: Input RMS:', inputRMS.toFixed(6), 'Threshold:', this.threshold.toFixed(6));
      }
      
      // Call WASM detectTick function
      // Function signature: detectTick(samplesPtr: i32, sampleCount: i32, threshold: f32, sensitivity: f32): i32
      // The first parameter is the byte offset in WASM memory
      const tickDetected = this.wasmExports.detectTick(
        samplesOffset, // Byte offset in WASM memory
        sampleCount,
        this.threshold,
        this.sensitivity
      );
      
      // Check if tick was detected
      if (tickDetected) {
        console.log('AudioWorklet: Tick detected! RMS:', inputRMS.toFixed(6));
        
        // Check duplicate detection window
        const timeSinceLastTick = this.currentSampleTime - this.lastTickTime;
        
        if (timeSinceLastTick >= this.duplicateWindowSamples) {
          // Not a duplicate, record this tick
          this.lastTickTime = this.currentSampleTime;
          
          // Calculate RMS for reporting
          // Function signature: calculateRMS(samplesPtr: i32, sampleCount: i32): f32
          const rms = this.wasmExports.calculateRMS(samplesOffset, sampleCount);
          
          // Calculate timestamp from sample time
          const timestamp = this.currentSampleTime / this.sampleRate;
          
          console.log('AudioWorklet: Posting tick event, RMS:', rms);
          
          // Post tick detection message to main thread
          this.port.postMessage({
            type: 'tickDetected',
            timestamp: timestamp,
            sampleTime: this.currentSampleTime,
            amplitude: rms,
            confidence: 1.0 // Could be calculated based on how much threshold was exceeded
          });
        } else {
          console.log('AudioWorklet: Tick ignored (duplicate within 50ms)');
        }
        // else: duplicate within 50ms window, ignore
      }
      
      // Update current sample time
      this.currentSampleTime += sampleCount;
      
    } catch (error) {
      console.error('TickProcessorWorklet: Error processing audio:', error);
      this.port.postMessage({
        type: 'error',
        error: 'Audio processing error',
        details: error.message
      });
    }
    
    // Keep processor alive
    return true;
  }
}

// Register the processor
registerProcessor('tick-processor', TickProcessorWorklet);
