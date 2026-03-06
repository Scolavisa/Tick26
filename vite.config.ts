import { defineConfig, type Plugin } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const buildTimestamp = new Date().toISOString()

// Plugin that injects the build timestamp into the service worker after build
function injectSwTimestamp(): Plugin {
  return {
    name: 'inject-sw-timestamp',
    apply: 'build',
    closeBundle() {
      const swPublic = resolve(__dirname, 'public/sw.js')
      const swDist = resolve(__dirname, 'dist/sw.js')
      if (!existsSync(swPublic)) {
        console.warn('[inject-sw-timestamp] WARNING: public/sw.js not found – service worker will not be versioned')
        return
      }
      const content = readFileSync(swPublic, 'utf-8')
      const distDir = resolve(__dirname, 'dist')
      if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true })
      writeFileSync(swDist, content.replace(/__BUILD_TIMESTAMP__/g, buildTimestamp))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), injectSwTimestamp()],
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
  },
  base: '/', // Base URL for GitHub Pages deployment at https://tick.scolavisa.eu
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router'],
        },
      },
    },
    // Ensure WASM and AudioWorklet files are copied to dist
    copyPublicDir: true,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['vue', 'vue-router'],
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.spec.ts',
        '**/*.test.ts',
      ],
    },
  },
})
