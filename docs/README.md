# Documentation Index

This directory contains all technical documentation for the Tick Tack Timer project.

## For Contributors

Essential documentation for developers contributing to the project:

- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines, development workflow, and code standards
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Detailed system architecture, design decisions, and implementation details
- **[TESTING.md](TESTING.md)** - Testing strategy, guidelines, and instructions
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Deployment process, troubleshooting, and GitHub Actions workflow

## Quick Links

### Getting Started
1. Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions
2. Review [ARCHITECTURE.md](ARCHITECTURE.md) to understand the system
3. Check [TESTING.md](TESTING.md) for testing guidelines
4. See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment process

### Common Tasks

**Running Tests:**
```bash
yarn test:run          # Run all tests
yarn test              # Watch mode
yarn test:ui           # Visual test runner
```

**Building:**
```bash
yarn build:wasm        # Build WASM module
yarn build             # Build application
yarn build:all         # Build everything
yarn verify:build      # Verify build integrity
```

**Development:**
```bash
yarn dev               # Start dev server
yarn preview           # Preview production build
```

## Documentation Structure

```
docs/
├── README.md                    # This file
├── CONTRIBUTING.md              # Contribution guidelines
├── ARCHITECTURE.md              # System architecture
├── TESTING.md                   # Testing guide
├── DEPLOYMENT.md                # Deployment guide
└── archive/                     # Historical development docs
    ├── CHECKPOINT-5-GUIDE.md
    ├── CHECKPOINT-10-COMPOSABLES.md
    ├── TASK-23-CHECKLIST.md
    ├── TEST-FIX-SUMMARY.md
    ├── FINAL-STATUS-REPORT.md
    ├── PRODUCTION-BUILD-TEST.md
    └── DEPLOYMENT-STATUS.md
```

## Archive

The `archive/` directory contains historical documentation from the development process:

- **Checkpoint guides** - Development milestone documentation
- **Task checklists** - Implementation task tracking
- **Test fix summaries** - Bug fix documentation
- **Status reports** - Development status snapshots

These documents are kept for historical reference but are not needed for ongoing development.

## External Resources

- **Live Demo:** https://tick.scolavisa.eu
- **Repository:** https://github.com/Scolavisa/Tick26
- **Issues:** https://github.com/Scolavisa/Tick26/issues
- **Discussions:** https://github.com/Scolavisa/Tick26/discussions

## Documentation Standards

When adding new documentation:

1. **Use Markdown** - All docs should be in Markdown format
2. **Be concise** - Focus on essential information
3. **Include examples** - Show, don't just tell
4. **Keep updated** - Update docs when code changes
5. **Link related docs** - Help readers find related information

## Need Help?

- **Questions:** Open a [GitHub Discussion](https://github.com/Scolavisa/Tick26/discussions)
- **Bugs:** Open a [GitHub Issue](https://github.com/Scolavisa/Tick26/issues)
- **Contributing:** See [CONTRIBUTING.md](CONTRIBUTING.md)

---

**Last Updated:** 2024-03-02
