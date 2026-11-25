import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration',
  fullyParallel: true,
  reporter: 'list',
  use: {
    // vite.config.ts sets `base: '/weight-trackerV2/'` for builds (this repo
    // deploys to a GitHub Pages *project* site, not a root site) — `vite
    // preview` serves the built dist/ at that same subpath, so tests have to
    // target it too, or they'd be exercising a URL the real deploy never has.
    baseURL: 'http://127.0.0.1:4173/weight-trackerV2/',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://127.0.0.1:4173/weight-trackerV2/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
