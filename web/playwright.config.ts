import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', timeout: 60_000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', viewport: {width:1440,height:1100},
    launchOptions: { executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  },
  webServer: { command: 'npm run preview -- --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
});
