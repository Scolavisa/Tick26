# Architecture Documentation

This document provides a detailed overview of the Tick Tack Timer architecture, design decisions, and implementation details.

## Table of Contents

- [System Overview](#system-overview)
- [Architecture Layers](#architecture-layers)
- [Audio Processing Pipeline](#audio-processing-pipeline)
- [Component Architecture](#component-architecture)
- [Data Flow](#data-flow)
- [State Management](#state-management)
- [PWA Architecture](#pwa-architecture)
- [Performance Considerations](#performance-considerations)
- [Security Considerations](#security-considerations)

## System Overview

Tick Tack Timer is a Progressive Web Application that uses advanced audio processing to detect and count mechanical clock ticks in real-time. The architecture is designed for:

- **Low latency** (<100ms audio processing)
- **High performance** (WASM for critical code)
- **Offline capability** (Service Worker caching)
- **Responsive design** (320px-768px screens)
- **Maintainability** (modular, testable code)

### Technology Choices

| Technology | Purpose | Rationale |
|------------|---------|-----------|
| Vue 3 | UI Framework | Composition API for better code organization |
| TypeScript | Type Safety | Catch errors at compile time |
| Vite | Build Tool | Fast development and optimized builds |
| AudioWorklet | Audio Processing | Non-blocking, low-latency audio |
| WebAssembly | Tick Detection | High-performance computation |
| AssemblyScript | WASM Source | TypeScript-like syntax for WASM |
| Vitest | Testing | Fast, Vite-native test runner |
| fast-check | Property Testing | Comprehensive input coverage |

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                   Presentation Layer                     │
│  (Vue Components, Router, UI State)                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  Application Layer                       │
│  (Composables, Business Logic, State Management)        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│               Audio Processing Layer                     │
│  (AudioManager, AudioWorklet, WASM)                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    PWA Layer                             │
│  (Service Worker, Manifest, Offline Support)            │
└─────────────────────────────────────────────────────────┘
```

### Presentation Layer

**Components:**
- `App.vue` - Root component with navigation
- `SettingsPage.vue` - Microphone selection
- `CalibrationPage.vue` - Clock size calibration
- `MeasurementPage.vue` - Tick counting and display
- `ErrorDisplay.vue` - Error messages

**Responsibilities:**
- Render UI based on state
- Handle user interactions
- Display real-time updates
- Provide visual feedback

### Application Layer

**Composables:**
- `useAudio` - Microphone and audio management
- `useCalibration` - Calibration logic and persistence
- `useCounter` - Tick counting and idle detection
- `useSession` - Session lifecycle and timing

**Responsibilities:**
- Business logic
- State management
- Data persistence (localStorage)
- Coordinate between layers

### Audio Processing Layer

**Components:**
- `AudioManager` - Audio system coordinator
- `TickProcessorWorklet` - Real-time audio processing
- `tick-detector.wasm` - High-performance tick detection

**Responsibilities:**
- Capture microphone input
- Process audio in real-time
- Detect tick events
- Maintain low latency (<100ms)

### PWA Layer

**Components:**
- `sw.js` - Service Worker for offline support
- `manifest.json` - PWA metadata
- Icons and assets

**Responsibilities:**
- Cache app shell and assets
- Enable offline functionality
- Provide installability
- Handle updates

## Audio Processing Pipeline

```
┌──────────────┐
│  Microphone  │
└──────┬───────┘
       │ getUserMedia()
       ↓
┌──────────────────┐
│  AudioContext    │
│  (Main Thread)   │
└──────┬───────────┘
       │ createMediaStreamSource()
       ↓
┌──────────────────────────┐
│  AudioWorkletNode        │
│  (Dedicated Thread)      │
│  - Receives 128 samples  │
│  - Non-blocking          │
└──────┬───────────────────┘
       │ process()
       ↓
┌──────────────────────────┐
│  WASM Tick Detector      │
│  - RMS calculation       │
│  - High-pass filter      │
│  - Threshold comparison  │
└──────┬───────────────────┘
       │ detectTick()
       ↓
┌──────────────────────────┐
│  Duplicate Detection     │
│  (50ms window)           │
└──────┬───────────────────┘
       │ postMessage()
       ↓
┌──────────────────────────┐
│  AudioManager            │
│  (Main Thread)           │
└──────┬───────────────────┘
       │ onTickDetected()
       ↓
┌──────────────────────────┐
│  Counter Composable      │
│  - Increment count       │
│  - Update UI             │
└──────────────────────────┘
```

### Why AudioWorklet?

AudioWorklet runs in a dedicated high-priority thread, ensuring:
- **Non-blocking:** Main thread remains responsive
- **Low latency:** Guaranteed <100ms processing
- **Consistent timing:** No jitter from main thread activity

### Why WebAssembly?

WASM provides:
- **Performance:** Near-native speed for audio processing
- **Predictability:** Consistent execution time
- **Small size:** 453 bytes compiled module

## Component Architecture

### AudioManager

**Purpose:** Coordinate audio system initialization and communication

**Key Methods:**
```typescript
class AudioManager {
  async initialize(deviceId?: string): Promise<void>
  async loadWorklet(): Promise<void>
  async loadWasm(): Promise<WebAssembly.Module>
  setCalibration(sensitivity: number, threshold: number): void
  start(): void
  stop(): void
  onTickDetected(callback: () => void): void
  cleanup(): void
}
```

**Responsibilities:**
- Initialize Web Audio API
- Load AudioWorklet processor
- Load and instantiate WASM module
- Connect audio graph
- Forward tick events to application

### Composables

#### useAudio

**State:**
```typescript
{
  audioContext: Ref<AudioContext | null>
  selectedDevice: Ref<string | null>
  availableDevices: Ref<MediaDeviceInfo[]>
  isInitialized: Ref<boolean>
  permissionGranted: Ref<boolean>
}
```

**Key Methods:**
- `requestPermission()` - Request microphone access
- `enumerateDevices()` - List audio input devices
- `selectDevice()` - Activate specific microphone
- `initializeWorklet()` - Set up AudioManager
- `startProcessing()` / `stopProcessing()` - Control audio

#### useCalibration

**State:**
```typescript
{
  clockSize: Ref<ClockSize>
  sensitivity: Ref<number>
  threshold: Ref<number>
  isCalibrating: Ref<boolean>
  calibrationProgress: Ref<number>
}
```

**Key Methods:**
- `startCalibration()` - Begin calibration
- `stopCalibration()` - Cancel calibration
- `saveCalibration()` - Persist to localStorage
- `loadCalibration()` - Restore from localStorage

#### useCounter

**State:**
```typescript
{
  count: Ref<number>
  lastTickTimestamp: Ref<number>
  isIdle: Ref<boolean>
}
```

**Key Methods:**
- `increment()` - Increase count
- `reset()` - Clear count
- Automatic idle detection (5 seconds)

#### useSession

**State:**
```typescript
{
  isActive: Ref<boolean>
  duration: Ref<number>
  startTime: Ref<number | null>
}
```

**Key Methods:**
- `start()` - Begin session
- `stop()` - End session
- `reset()` - Clear session
- Automatic duration tracking

## Data Flow

### Tick Detection Flow

```
User clicks "Start Session"
  ↓
MeasurementPage.handleStart()
  ↓
useSession.start() → Reset counter
  ↓
useAudio.initializeWorklet() → Load AudioWorklet & WASM
  ↓
useAudio.setCalibration() → Send settings to worklet
  ↓
useAudio.startProcessing() → Connect audio graph
  ↓
[Audio flows through pipeline]
  ↓
Tick detected in WASM
  ↓
AudioWorklet posts message to main thread
  ↓
AudioManager receives message
  ↓
AudioManager calls onTickDetected callback
  ↓
useCounter.increment()
  ↓
Vue reactivity updates UI
  ↓
MeasurementPage shows new count + visual feedback
```

### Calibration Flow

```
User selects clock size
  ↓
CalibrationPage updates clockSize
  ↓
User clicks "Start Calibration"
  ↓
useCalibration.startCalibration()
  ↓
useAudio.initializeWorklet()
  ↓
useAudio.startProcessing()
  ↓
[Ticks detected during calibration]
  ↓
useCalibration collects samples
  ↓
After 10+ ticks collected
  ↓
useCalibration calculates sensitivity & threshold
  ↓
useCalibration.saveCalibration() → localStorage
  ↓
User navigates to Measurement page
```

## State Management

### Reactive State (Vue Refs)

All composables use Vue's `ref()` for reactive state:
- Automatic UI updates when state changes
- No manual DOM manipulation needed
- Efficient change detection

### Persistent State (localStorage)

Persisted data:
- **Microphone selection:** `tick-tack-audio-device`
- **Calibration settings:** `tick-tack-calibration`
- **Error logs:** `tick-tack-errors`

### Singleton Pattern

Composables use singleton pattern:
- Single instance shared across components
- Consistent state throughout app
- Efficient memory usage

## PWA Architecture

### Service Worker Strategy

**Cache-First Strategy:**
```javascript
// Install: Cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/manifest.json',
        '/tick-detector.wasm',
        '/tick-processor.worklet.js',
        // ... other assets
      ])
    })
  )
})

// Fetch: Serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request)
    })
  )
})
```

**Benefits:**
- Fast loading (serve from cache)
- Offline functionality
- Reduced bandwidth usage

### Manifest Configuration

```json
{
  "name": "Tick Tack Timer",
  "short_name": "TickTack",
  "display": "standalone",
  "orientation": "any",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192" },
    { "src": "/icons/icon-512.png", "sizes": "512x512" }
  ]
}
```

**Features:**
- Installable to home screen
- Standalone mode (no browser UI)
- Custom icons and splash screen

## Performance Considerations

### Bundle Optimization

- **Code splitting:** Routes loaded on demand
- **Tree shaking:** Unused code removed
- **Minification:** Reduced file sizes
- **Gzip compression:** Smaller transfer sizes

**Results:**
- Total: 756 KB
- Vue vendor: 87.19 KB (gzipped: 34.00 KB)
- WASM: 453 bytes

### Audio Processing

- **AudioWorklet:** Dedicated thread, no main thread blocking
- **WASM:** Near-native performance for tick detection
- **Efficient algorithms:** RMS calculation, high-pass filter
- **Duplicate detection:** 50ms window prevents false positives

### Rendering Performance

- **Vue 3 reactivity:** Efficient change detection
- **Virtual DOM:** Minimal DOM updates
- **CSS animations:** Hardware-accelerated
- **Debouncing:** Prevent excessive updates

## Security Considerations

### Microphone Access

- **HTTPS required:** getUserMedia only works on secure origins
- **User permission:** Explicit permission request
- **Permission revocation:** Graceful handling if revoked
- **No recording:** Audio processed in real-time, not stored

### Content Security Policy

- **No inline scripts:** All scripts in separate files
- **No eval():** No dynamic code execution
- **HTTPS only:** All resources loaded over HTTPS

### Data Privacy

- **Local storage only:** No data sent to servers
- **No analytics:** No tracking or telemetry
- **No cookies:** No user tracking
- **Open source:** Code is auditable

## Error Handling

### Error Categories

1. **Permission Errors:** Microphone access denied
2. **Initialization Errors:** AudioWorklet or WASM load failure
3. **Calibration Errors:** Timeout or insufficient samples
4. **Runtime Errors:** Audio stream interruption

### Error Recovery

- **Automatic retry:** For transient errors
- **Graceful degradation:** Continue with reduced functionality
- **User guidance:** Clear error messages with resolution steps
- **Error logging:** Store last 50 errors for debugging

## Testing Strategy

### Unit Tests

- Test individual functions and components
- Mock external dependencies
- Focus on specific scenarios

### Property-Based Tests

- Test universal properties
- Generate random inputs (100+ iterations)
- Validate correctness properties

### Integration Tests

- Test component interactions
- Verify data flow
- Test full workflows

**Coverage:** 344 tests, 100% passing

## Future Considerations

### Potential Enhancements

- **Multiple clock tracking:** Count ticks from multiple clocks
- **Export functionality:** Export session data as CSV
- **Statistics:** Average tick rate, session history
- **Themes:** Dark mode, custom colors
- **Accessibility:** Screen reader support, keyboard navigation

### Scalability

- **Modular architecture:** Easy to add new features
- **Composable pattern:** Reusable logic
- **Test coverage:** Ensures stability during changes
- **Documentation:** Comprehensive guides for contributors

---

For more information, see:
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment instructions
- [TESTING.md](TESTING.md) - Testing guidelines
