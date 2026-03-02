# Tick Tack Timer

> A Progressive Web Application for real-time mechanical clock tick detection and counting using advanced audio processing.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-344%20passing-brightgreen.svg)](tests/)
[![PWA](https://img.shields.io/badge/PWA-enabled-purple.svg)](https://tick.scolavisa.eu)

**Live Demo:** [https://tick.scolavisa.eu](https://tick.scolavisa.eu)

## Overview

Tick Tack Timer is a PWA that listens to mechanical clock ticks using your device's microphone and counts them in real-time. It uses high-performance audio processing through AudioWorklet and WebAssembly to detect ticks with minimal latency.

### Key Features

- 🎯 **Real-time tick detection** with <100ms latency
- 🎤 **Microphone selection** (internal or external USB-C)
- ⚙️ **Calibration system** for different clock sizes (small/medium/large)
- 📊 **Session management** with duration tracking
- 💾 **Offline support** via Service Worker
- 📱 **PWA installable** on mobile and desktop
- 🎨 **Responsive design** (320px-768px)
- ⚡ **High-performance** WASM-based audio processing

## Technology Stack

- **Frontend:** Vue 3 with Composition API
- **Language:** TypeScript (strict mode)
- **Build Tool:** Vite
- **Router:** Vue Router 4
- **Testing:** Vitest + fast-check (property-based testing)
- **Audio Processing:** AudioWorklet + WebAssembly (AssemblyScript)
- **PWA:** Service Worker + Web App Manifest
- **Package Manager:** Yarn

## Browser Requirements

- Chrome 66+ (AudioWorklet support)
- Edge 79+ (AudioWorklet support)
- Safari 14.1+ (AudioWorklet support)
- Firefox 76+ (AudioWorklet support)

## Quick Start

### Prerequisites

- Node.js 20+
- Yarn package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/Scolavisa/Tick26.git
cd Tick26

# Install dependencies
yarn install

# Build WASM module
yarn build:wasm
```

### Development

```bash
# Start development server
yarn dev

# Open http://localhost:5173
```

### Testing

```bash
# Run all tests (344 tests)
yarn test:run

# Run tests in watch mode
yarn test

# Run tests with UI
yarn test:ui

# Generate coverage report
yarn coverage
```

### Production Build

```bash
# Build WASM and application
yarn build:all

# Verify build integrity
yarn verify:build

# Preview production build
yarn preview
```

## Project Structure

```
tick-tack-timer/
├── src/
│   ├── audio/              # Audio processing system
│   │   ├── AudioManager.ts # Audio system coordinator
│   │   └── tick-detector-math.ts
│   ├── components/         # Vue components
│   │   └── ErrorDisplay.vue
│   ├── composables/        # Vue composables
│   │   ├── useAudio.ts     # Microphone & audio management
│   │   ├── useCalibration.ts # Calibration logic
│   │   ├── useCounter.ts   # Tick counting
│   │   └── useSession.ts   # Session management
│   ├── pages/              # Page components
│   │   ├── SettingsPage.vue
│   │   ├── CalibrationPage.vue
│   │   └── MeasurementPage.vue
│   ├── router/             # Vue Router configuration
│   ├── styles/             # Global styles
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   ├── App.vue             # Root component
│   └── main.ts             # Application entry point
├── assembly/               # AssemblyScript/WASM
│   └── tick-detector.ts    # High-performance tick detection
├── public/                 # Static assets
│   ├── tick-processor.worklet.js # AudioWorklet processor
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker
│   └── icons/              # PWA icons
├── tests/                  # Test suites
│   ├── unit/               # Unit tests
│   └── property/           # Property-based tests
├── docs/                   # Documentation
└── .github/workflows/      # CI/CD workflows
```

## Architecture

### Audio Processing Pipeline

```
Microphone → AudioContext → AudioWorklet → WASM Detector → Counter → UI
```

1. **Microphone Input:** Captures audio via getUserMedia API
2. **AudioWorklet:** Processes audio in dedicated thread (non-blocking)
3. **WASM Module:** High-performance tick detection algorithm
4. **Counter:** Maintains tick count and session state
5. **UI:** Real-time display with visual feedback

### Key Components

- **AudioManager:** Coordinates audio system initialization and communication
- **TickProcessorWorklet:** Real-time audio processing in AudioWorklet thread
- **Tick Detector (WASM):** High-performance RMS calculation and threshold detection
- **Composables:** Reactive state management for audio, calibration, counting, and sessions

## Development Guide

### Adding New Features

1. **Create a spec** in `.kiro/specs/` following the spec-driven development methodology
2. **Write tests first** (unit + property-based tests)
3. **Implement the feature** following the existing architecture
4. **Update documentation** in `docs/`

### Testing Strategy

The project uses a dual testing approach:

- **Unit Tests:** Specific scenarios with known inputs/outputs
- **Property-Based Tests:** 100+ iterations with random inputs to validate universal properties

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for detailed testing guidelines.

### Code Style

- TypeScript strict mode enabled
- ESLint + Prettier for code formatting
- Vue 3 Composition API with `<script setup>`
- Functional programming patterns preferred

## Deployment

The project uses GitHub Actions for automatic deployment to GitHub Pages.

### Automatic Deployment

Every push to `main` branch triggers:
1. Dependency installation
2. WASM module build
3. Test suite execution (344 tests)
4. Application build
5. Build verification
6. Deployment to GitHub Pages

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions.

## Documentation

- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Deployment guide and troubleshooting
- **[CONTRIBUTING.md](docs/CONTRIBUTING.md)** - Contribution guidelines
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Detailed architecture documentation
- **[TESTING.md](docs/TESTING.md)** - Testing strategy and guidelines

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for your changes
4. Implement your changes
5. Ensure all tests pass (`yarn test:run`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## Testing

The project has comprehensive test coverage:

- **344 tests** across 23 test files
- **Unit tests** for all components, composables, and audio system
- **Property-based tests** for correctness properties
- **100% passing** test suite

Run tests with:
```bash
yarn test:run
```

## Performance

- **Bundle Size:** 756 KB total
- **Vue Vendor Bundle:** 87.19 KB (gzipped: 34.00 KB)
- **WASM Module:** 453 bytes
- **Audio Processing Latency:** <100ms
- **Test Suite Duration:** ~9 seconds

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Vue 3](https://vuejs.org/)
- Audio processing powered by [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- WASM compiled from [AssemblyScript](https://www.assemblyscript.org/)
- Property-based testing with [fast-check](https://github.com/dubzzz/fast-check)

## Support

- **Issues:** [GitHub Issues](https://github.com/Scolavisa/Tick26/issues)
- **Discussions:** [GitHub Discussions](https://github.com/Scolavisa/Tick26/discussions)
- **Live Demo:** [https://tick.scolavisa.eu](https://tick.scolavisa.eu)

## Project Status

✅ **Production Ready** - All features implemented and tested

- 344/344 tests passing
- Production build verified
- Deployed to GitHub Pages
- PWA installable on mobile and desktop

---

**Made with ❤️ for mechanical clock enthusiasts**
