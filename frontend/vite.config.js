import { defineConfig } from "vite";

// JobQuest's frontend is served by the existing Node backend (backend/src/server.js),
// which reads static files directly from frontend/dist and applies its own
// Content-Security-Policy headers. Vite here is a build tool only — there is no Vite
// dev server / HMR proxy involved, to avoid introducing a second origin, a second set
// of CSP/CORS assumptions, or any change to how auth cookies are sent. See
// docs/ARCHITECTURE.md and docs/FEATURE_UPGRADE_2.md for the rationale.
export default defineConfig({
  // Default root is process.cwd(); always run Vite from frontend/ (npm scripts here,
  // or `npm run build --prefix frontend` from the repo root) so index.html and
  // public/ resolve correctly.
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // No source maps: keeps the security posture identical to today (nothing new is
    // exposed to the browser) and avoids the question of guarding a debug endpoint.
    sourcemap: false,
  },
});
