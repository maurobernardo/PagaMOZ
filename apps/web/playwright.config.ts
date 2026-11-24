import { defineConfig, devices } from "@playwright/test";

const PY = process.platform === "win32" ? ".venv\\Scripts\\python.exe" : ".venv/bin/python";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure", locale: "pt-PT" },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  // Localmente reaproveita servidores já a correr (.\tasks.ps1 up). No CI arranca-os.
  webServer: [
    {
      command: `${PY} manage.py migrate && ${PY} manage.py seed_demo && ${PY} manage.py runserver 8000 --noreload`,
      cwd: "../api",
      url: "http://localhost:8000/api/health",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: process.env.E2E_DEV ? "npm run dev" : "npm run start", // dev recompila a meio dos testes
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
