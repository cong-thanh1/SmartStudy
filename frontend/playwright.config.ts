// Keep the Playwright configuration discoverable when tests are started with
// `npx playwright test` from the frontend directory.
//
// The E2E suite itself lives in e2e/, but Playwright only auto-loads a config
// file from the current directory (or one of its parents).
export { default } from './e2e/playwright.config';
