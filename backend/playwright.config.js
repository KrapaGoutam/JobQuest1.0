import { defineConfig } from "@playwright/test";

const viewports = [
  ["desktop", 1440, 1000],
  ["compact-desktop", 1024, 900],
  ["tablet", 768, 1024],
  ["mobile", 390, 844],
  ["small-mobile", 360, 800],
];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.025 } },
  outputDir: "test-results/playwright",
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}",
  reporter: [
    ["line"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    colorScheme: "light",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: viewports.map(([name, width, height]) => ({
    name,
    use: { viewport: { width, height } },
  })),
  webServer: {
    command: "node src/server.js",
    url: "http://127.0.0.1:4173/health",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: "4173",
      DATABASE_PATH: "./test-results/jobquest-e2e.sqlite3",
      ...(process.env.TEST_DATABASE_URL
        ? { DATABASE_URL: process.env.TEST_DATABASE_URL }
        : {}),
    },
  },
});
