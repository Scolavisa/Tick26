# Contributing to Tick Tack Timer

Thank you for your interest in contributing to Tick Tack Timer! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

### Prerequisites

- Node.js 20 or higher
- Yarn package manager
- Git
- A modern browser (Chrome 66+, Edge 79+, Safari 14.1+, or Firefox 76+)

### Setting Up Your Development Environment

1. **Fork the repository** on GitHub

2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Tick26.git
   cd Tick26
   ```

3. **Add upstream remote:**
   ```bash
   git remote add upstream https://github.com/Scolavisa/Tick26.git
   ```

4. **Install dependencies:**
   ```bash
   yarn install
   ```

5. **Build WASM module:**
   ```bash
   yarn build:wasm
   ```

6. **Start development server:**
   ```bash
   yarn dev
   ```

7. **Run tests:**
   ```bash
   yarn test:run
   ```

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

Use descriptive branch names:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `test/` - Test additions or modifications
- `refactor/` - Code refactoring

### 2. Make Your Changes

Follow the project's coding standards:

#### TypeScript Guidelines
- Use TypeScript strict mode
- Provide type annotations for all functions
- Avoid `any` types
- Use interfaces for object shapes

#### Vue Guidelines
- Use Composition API with `<script setup>`
- Keep components focused and single-purpose
- Use composables for shared logic
- Follow Vue 3 best practices

#### Code Style
- Use 2 spaces for indentation
- Use single quotes for strings
- Add semicolons
- Use meaningful variable names
- Add JSDoc comments for public APIs

### 3. Write Tests

**All new features must include tests.**

#### Unit Tests
Create unit tests in `tests/unit/` for:
- Specific scenarios with known inputs/outputs
- Edge cases and boundary conditions
- Error handling

Example:
```typescript
describe('MyComponent', () => {
  it('should do something specific', () => {
    // Arrange
    const input = 'test'
    
    // Act
    const result = myFunction(input)
    
    // Assert
    expect(result).toBe('expected')
  })
})
```

#### Property-Based Tests
Create property tests in `tests/property/` for:
- Universal properties that should hold for all inputs
- Validating correctness properties from design

Example:
```typescript
import fc from 'fast-check'

// Feature: tick-tack-timer, Property X: Description
test('property description', () => {
  fc.assert(
    fc.property(
      fc.integer(), // Generator
      (value) => {
        // Property that should always hold
        expect(myFunction(value)).toBeGreaterThan(0)
      }
    ),
    { numRuns: 100 }
  )
})
```

### 4. Run Tests

```bash
# Run all tests
yarn test:run

# Run tests in watch mode
yarn test

# Run specific test file
yarn test path/to/test.spec.ts

# Generate coverage report
yarn coverage
```

**All tests must pass before submitting a PR.**

### 5. Build and Verify

```bash
# Build WASM module
yarn build:wasm

# Build application
yarn build

# Verify build
yarn verify:build

# Preview production build
yarn preview
```

### 6. Commit Your Changes

Use conventional commit messages:

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Test additions or modifications
- `refactor:` - Code refactoring
- `style:` - Code style changes (formatting, etc.)
- `perf:` - Performance improvements
- `chore:` - Build process or auxiliary tool changes

**Examples:**
```bash
git commit -m "feat(audio): add external microphone support"
git commit -m "fix(calibration): correct threshold calculation"
git commit -m "docs(readme): update installation instructions"
git commit -m "test(counter): add property tests for idle detection"
```

### 7. Push and Create Pull Request

```bash
# Push to your fork
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Pull Request Guidelines

### PR Title
Use the same format as commit messages:
```
type(scope): description
```

### PR Description
Include:
1. **What** - What changes does this PR introduce?
2. **Why** - Why are these changes needed?
3. **How** - How were the changes implemented?
4. **Testing** - What tests were added/modified?
5. **Screenshots** - If UI changes, include before/after screenshots

### PR Checklist
- [ ] Code follows project style guidelines
- [ ] All tests pass (`yarn test:run`)
- [ ] New tests added for new features
- [ ] Documentation updated if needed
- [ ] Build succeeds (`yarn build:all`)
- [ ] Build verification passes (`yarn verify:build`)
- [ ] No TypeScript errors
- [ ] Commit messages follow conventional format

## Testing Guidelines

### Test Organization

```
tests/
├── unit/
│   ├── audio/           # Audio system tests
│   ├── components/      # Component tests
│   ├── composables/     # Composable tests
│   └── router/          # Router tests
└── property/            # Property-based tests
```

### Writing Good Tests

1. **Test behavior, not implementation**
   - Focus on what the code does, not how it does it
   - Test public APIs, not internal details

2. **Use descriptive test names**
   ```typescript
   // Good
   it('should increment counter when tick is detected')
   
   // Bad
   it('test counter')
   ```

3. **Follow AAA pattern**
   - Arrange: Set up test data
   - Act: Execute the code being tested
   - Assert: Verify the results

4. **Keep tests independent**
   - Each test should run in isolation
   - Use `beforeEach` for setup
   - Use `afterEach` for cleanup

5. **Test edge cases**
   - Null/undefined values
   - Empty arrays/strings
   - Boundary values
   - Error conditions

### Property-Based Testing

Property tests validate universal properties:

```typescript
// Property: For any valid input, output should satisfy X
fc.assert(
  fc.property(
    fc.array(fc.float()), // Generate random arrays of floats
    (samples) => {
      const result = processAudio(samples)
      // Property: Result should always be non-negative
      expect(result).toBeGreaterThanOrEqual(0)
    }
  ),
  { numRuns: 100 }
)
```

## Code Review Process

1. **Automated Checks**
   - All tests must pass
   - Build must succeed
   - No TypeScript errors

2. **Manual Review**
   - Code quality and style
   - Test coverage
   - Documentation completeness
   - Performance considerations

3. **Feedback**
   - Address reviewer comments
   - Push additional commits to the same branch
   - Request re-review when ready

## Architecture Guidelines

### Audio Processing
- Use AudioWorklet for real-time processing
- Keep WASM module focused on performance-critical code
- Handle errors gracefully with user-friendly messages

### State Management
- Use Vue composables for shared state
- Keep composables focused and single-purpose
- Use localStorage for persistence

### Component Design
- Keep components small and focused
- Use props for input, events for output
- Avoid prop drilling - use composables instead

### Performance
- Minimize bundle size
- Use code splitting for routes
- Optimize WASM module size
- Cache static assets in service worker

## Documentation

### Code Documentation
- Add JSDoc comments for public APIs
- Include parameter descriptions and return types
- Add usage examples for complex functions

### User Documentation
- Update README.md for user-facing changes
- Add/update docs in `docs/` directory
- Include screenshots for UI changes

## Getting Help

- **Questions:** Open a [GitHub Discussion](https://github.com/Scolavisa/Tick26/discussions)
- **Bugs:** Open a [GitHub Issue](https://github.com/Scolavisa/Tick26/issues)
- **Security:** Email security concerns privately

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes for significant contributions
- Project documentation

Thank you for contributing to Tick Tack Timer! 🎉
