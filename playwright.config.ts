import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  webServer: {
    command: 'npx vite --port 4174',
    port: 4174,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:4174',
  },
});
