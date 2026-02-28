# Deployment Guide

## GitHub Pages Deployment

This project is configured to automatically deploy to GitHub Pages using GitHub Actions.

### Automatic Deployment

Every push to the `main` branch triggers an automatic deployment:

1. **Build Process:**
   - Install dependencies
   - Build WASM module (`yarn build:wasm`)
   - Run tests (`yarn test:run`)
   - Build application (`yarn build`)

2. **Deploy Process:**
   - Upload `dist/` folder to GitHub Pages
   - Deploy to https://tick.scolavisa.eu

### Manual Deployment

You can also trigger a deployment manually:

1. Go to your repository on GitHub
2. Click "Actions" tab
3. Select "Deploy to GitHub Pages" workflow
4. Click "Run workflow"

### First-Time Setup

To enable GitHub Pages for your repository:

1. Go to repository **Settings** → **Pages**
2. Under "Build and deployment":
   - Source: **GitHub Actions**
3. Save the settings

### Custom Domain Setup

To use the custom domain `tick.scolavisa.eu`:

1. Go to repository **Settings** → **Pages**
2. Under "Custom domain", enter: `tick.scolavisa.eu`
3. Click "Save"
4. Configure DNS records with your domain provider:
   ```
   Type: CNAME
   Name: tick
   Value: <your-github-username>.github.io
   ```
5. Wait for DNS propagation (can take up to 24 hours)
6. Enable "Enforce HTTPS" once DNS is configured

### Build Artifacts

The following files are **generated during build** and should NOT be committed:

- `dist/` - Production build output
- `public/tick-detector.wasm` - Compiled WASM module
- `public/tick-detector.wat` - WASM text format (for debugging)

These are listed in `.gitignore` and will be built automatically by GitHub Actions.

### Local Testing

To test the production build locally:

```bash
# Build everything
yarn build:wasm
yarn build

# Preview the production build
yarn preview
```

Then open http://localhost:4173 to test the production build.

### Troubleshooting

**Build fails in GitHub Actions:**
- Check the Actions tab for error logs
- Ensure all tests pass locally: `yarn test:run`
- Verify WASM builds: `yarn build:wasm`
- Verify app builds: `yarn build`

**404 errors after deployment:**
- Check that base URL in `vite.config.ts` matches your deployment path
- For custom domain: base should be `/`
- For github.io subdirectory: base should be `/repository-name/`

**Custom domain not working:**
- Verify DNS records are configured correctly
- Wait for DNS propagation (up to 24 hours)
- Check GitHub Pages settings show "DNS check successful"

### Deployment Checklist

Before pushing to main:

- [ ] All tests pass: `yarn test:run`
- [ ] WASM builds: `yarn build:wasm`
- [ ] App builds: `yarn build`
- [ ] No TypeScript errors: `yarn build`
- [ ] Changes committed to git
- [ ] Push to main branch

GitHub Actions will handle the rest!
