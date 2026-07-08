import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Playwright E2E configuration for SmartStudyAI
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './',
  testMatch: '**/*.spec.ts',
  timeout: 90_000,          // LLM-based operations (quiz/exam generation) can be slow
  expect: { timeout: 15_000 },
  retries: 0,               // NO retries — flaky tests must be diagnosed, not hidden
  workers: 1,               // Sequential execution to avoid data race on shared test user
  reporter: [
    ['html', { open: 'never', outputFolder: '../playwright-report' }],
    ['list'],
    ['json', { outputFile: '../playwright-report/results.json' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Slow down interactions for observability in headed mode
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    // Auth setup — runs first, saves storageState
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // Chromium tests — depend on auth setup
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, 'fixtures/storageState.json') 
      },
      dependencies: ['setup'],
    },
    // Firefox tests — depend on auth setup
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        storageState: path.join(__dirname, 'fixtures/storageState.json')
      },
      dependencies: ['setup'],
    },
  ],
  // Output directory for test artifacts
  outputDir: '../test-results',
});
