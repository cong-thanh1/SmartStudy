#!/usr/bin/env node
/**
 * SmartStudy AI — Playwright E2E Test Setup Script
 *
 * Run this ONCE to:
 *   1. Install Playwright and browsers
 *   2. Create the QA test user (if it doesn't exist yet)
 *   3. Run the auth setup to generate storageState.json
 *
 * Usage:
 *   node e2e/setup.mjs
 *
 * Environment variables:
 *   BASE_URL       — Frontend URL (default: http://localhost:3000)
 *   QA_EMAIL       — QA user email (default: qa_user_a@test.com)
 *   QA_PASSWORD    — QA user password (default: QaTestPassword123!)
 *   API_BASE_URL   — Backend API URL (default: http://localhost:3000/api/v1)
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';
const QA_EMAIL = process.env.QA_EMAIL || 'qa_user_a@test.com';
const QA_PASSWORD = process.env.QA_PASSWORD || 'QaTestPassword123!';

console.log('='.repeat(60));
console.log('SmartStudy AI — Playwright E2E Setup');
console.log('='.repeat(60));
console.log(`BASE_URL    : ${BASE_URL}`);
console.log(`API_BASE    : ${API_BASE}`);
console.log(`QA_EMAIL    : ${QA_EMAIL}`);
console.log('='.repeat(60));

// Step 1: Install Playwright
console.log('\n[Step 1] Installing @playwright/test...');
try {
  execSync('npm install --save-dev @playwright/test', {
    cwd: ROOT,
    stdio: 'inherit',
  });
  console.log('[Step 1] ✅ @playwright/test installed');
} catch (err) {
  console.error('[Step 1] ❌ Failed to install @playwright/test:', err.message);
  process.exit(1);
}

// Step 2: Install Playwright browsers (Chromium only for speed, add Firefox later)
console.log('\n[Step 2] Installing Playwright browsers (chromium, firefox)...');
try {
  execSync('npx playwright install --with-deps chromium firefox', {
    cwd: ROOT,
    stdio: 'inherit',
  });
  console.log('[Step 2] ✅ Browsers installed');
} catch (err) {
  console.error('[Step 2] ❌ Failed to install browsers:', err.message);
  process.exit(1);
}

// Step 3: Create QA test user via API
console.log(`\n[Step 3] Creating QA user: ${QA_EMAIL}...`);
try {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: QA_EMAIL,
      password: QA_PASSWORD,
      fullName: 'QA Test User A',
    }),
  });

  if (response.ok) {
    console.log('[Step 3] ✅ QA user created successfully');
  } else if (response.status === 409 || response.status === 400) {
    console.log('[Step 3] ℹ️  QA user already exists — skipping registration');
  } else {
    const body = await response.json().catch(() => ({}));
    console.warn(`[Step 3] ⚠️  Unexpected response ${response.status}: ${JSON.stringify(body)}`);
  }
} catch (err) {
  console.warn(`[Step 3] ⚠️  Could not reach API to create user: ${err.message}`);
  console.warn('         Make sure the backend is running before proceeding.');
}

// Step 4: Run auth setup to generate storageState.json
console.log('\n[Step 4] Running auth setup (generates storageState.json)...');
try {
  execSync(
    `npx playwright test --config=e2e/playwright.config.ts --project=setup`,
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        BASE_URL,
        QA_EMAIL,
        QA_PASSWORD,
      },
    }
  );
  console.log('[Step 4] ✅ Auth setup complete — storageState.json created');
} catch (err) {
  console.error('[Step 4] ❌ Auth setup failed. Check the error above.');
  console.error('   Make sure the frontend is running at:', BASE_URL);
  process.exit(1);
}

console.log('\n' + '='.repeat(60));
console.log('✅ Setup complete! You can now run the tests:');
console.log('');
console.log('  # Run all tests (headless):');
console.log('  npx playwright test --config=e2e/playwright.config.ts');
console.log('');
console.log('  # Run a specific group:');
console.log('  npx playwright test --config=e2e/playwright.config.ts tests/documents-upload.spec.ts');
console.log('');
console.log('  # View the HTML report:');
console.log('  npx playwright show-report playwright-report');
console.log('='.repeat(60));
