#!/usr/bin/env node

/**
 * Verify Production Build Script
 * 
 * This script verifies that the production build contains all required assets
 * and that they are properly configured for deployment.
 */

import { existsSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

const DIST_DIR = 'dist';
const REQUIRED_FILES = [
  'index.html',
  'manifest.json',
  'sw.js',
  'favicon.ico',
  'tick-detector.wasm',
  'tick-processor.worklet.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

const REQUIRED_ASSET_PATTERNS = [
  /assets\/.*\.js$/,
  /assets\/.*\.css$/,
];

let errors = 0;
let warnings = 0;

console.log('🔍 Verifying production build...\n');

// Check if dist directory exists
if (!existsSync(DIST_DIR)) {
  console.error('❌ ERROR: dist/ directory not found. Run "yarn build" first.');
  process.exit(1);
}

// Check required files
console.log('📁 Checking required files:');
for (const file of REQUIRED_FILES) {
  const filePath = join(DIST_DIR, file);
  if (existsSync(filePath)) {
    const stats = statSync(filePath);
    const size = (stats.size / 1024).toFixed(2);
    console.log(`  ✅ ${file} (${size} KB)`);
  } else {
    console.error(`  ❌ ${file} - MISSING`);
    errors++;
  }
}

// Check manifest.json content
console.log('\n📋 Checking manifest.json:');
try {
  const manifestPath = join(DIST_DIR, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  
  const requiredFields = ['name', 'short_name', 'start_url', 'display', 'icons'];
  for (const field of requiredFields) {
    if (manifest[field]) {
      console.log(`  ✅ ${field}: ${typeof manifest[field] === 'object' ? 'configured' : manifest[field]}`);
    } else {
      console.error(`  ❌ ${field} - MISSING`);
      errors++;
    }
  }
  
  // Check icons array
  if (manifest.icons && manifest.icons.length >= 2) {
    console.log(`  ✅ icons: ${manifest.icons.length} icons configured`);
  } else {
    console.error(`  ❌ icons: Need at least 2 icons (192x192 and 512x512)`);
    errors++;
  }
} catch (error) {
  console.error(`  ❌ Failed to parse manifest.json: ${error.message}`);
  errors++;
}

// Check service worker
console.log('\n🔧 Checking service worker:');
try {
  const swPath = join(DIST_DIR, 'sw.js');
  const swContent = readFileSync(swPath, 'utf-8');
  
  const requiredSWFeatures = [
    { pattern: /addEventListener\(['"]install['"]/, name: 'install event' },
    { pattern: /addEventListener\(['"]activate['"]/, name: 'activate event' },
    { pattern: /addEventListener\(['"]fetch['"]/, name: 'fetch event' },
    { pattern: /caches\.open/, name: 'cache API' },
  ];
  
  for (const { pattern, name } of requiredSWFeatures) {
    if (pattern.test(swContent)) {
      console.log(`  ✅ ${name}`);
    } else {
      console.error(`  ❌ ${name} - NOT FOUND`);
      errors++;
    }
  }
} catch (error) {
  console.error(`  ❌ Failed to read sw.js: ${error.message}`);
  errors++;
}

// Check index.html
console.log('\n📄 Checking index.html:');
try {
  const indexPath = join(DIST_DIR, 'index.html');
  const indexContent = readFileSync(indexPath, 'utf-8');
  
  const requiredHTMLFeatures = [
    { pattern: /<link[^>]+rel=["']manifest["']/, name: 'manifest link' },
    { pattern: /<meta[^>]+name=["']theme-color["']/, name: 'theme-color meta' },
    { pattern: /<link[^>]+rel=["']apple-touch-icon["']/, name: 'apple-touch-icon' },
    { pattern: /<meta[^>]+name=["']viewport["']/, name: 'viewport meta' },
  ];
  
  for (const { pattern, name } of requiredHTMLFeatures) {
    if (pattern.test(indexContent)) {
      console.log(`  ✅ ${name}`);
    } else {
      console.error(`  ❌ ${name} - NOT FOUND`);
      errors++;
    }
  }
} catch (error) {
  console.error(`  ❌ Failed to read index.html: ${error.message}`);
  errors++;
}

// Check WASM file
console.log('\n🔬 Checking WASM module:');
try {
  const wasmPath = join(DIST_DIR, 'tick-detector.wasm');
  const stats = statSync(wasmPath);
  const size = stats.size;
  
  if (size > 0 && size < 100000) { // Should be small, less than 100KB
    console.log(`  ✅ WASM file size: ${size} bytes`);
  } else if (size === 0) {
    console.error(`  ❌ WASM file is empty`);
    errors++;
  } else {
    console.warn(`  ⚠️  WASM file is large: ${(size / 1024).toFixed(2)} KB`);
    warnings++;
  }
} catch (error) {
  console.error(`  ❌ Failed to check WASM: ${error.message}`);
  errors++;
}

// Check AudioWorklet
console.log('\n🎵 Checking AudioWorklet:');
try {
  const workletPath = join(DIST_DIR, 'tick-processor.worklet.js');
  const workletContent = readFileSync(workletPath, 'utf-8');
  
  if (workletContent.includes('AudioWorkletProcessor')) {
    console.log(`  ✅ AudioWorkletProcessor class found`);
  } else {
    console.error(`  ❌ AudioWorkletProcessor class not found`);
    errors++;
  }
  
  if (workletContent.includes('registerProcessor')) {
    console.log(`  ✅ registerProcessor call found`);
  } else {
    console.error(`  ❌ registerProcessor call not found`);
    errors++;
  }
} catch (error) {
  console.error(`  ❌ Failed to check AudioWorklet: ${error.message}`);
  errors++;
}

// Summary
console.log('\n' + '='.repeat(50));
if (errors === 0 && warnings === 0) {
  console.log('✅ All checks passed! Build is ready for deployment.');
  process.exit(0);
} else if (errors === 0) {
  console.log(`⚠️  Build passed with ${warnings} warning(s).`);
  process.exit(0);
} else {
  console.error(`❌ Build verification failed with ${errors} error(s) and ${warnings} warning(s).`);
  process.exit(1);
}
