import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:8001',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: '../.venv/bin/python ../scripts/serve_e2e.py',
    url: 'http://127.0.0.1:8001/api/health',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
