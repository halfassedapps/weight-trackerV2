/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://halfassedapps.github.io/weight-trackerV2/ (a GitHub
  // Pages *project* site, not a user/org root site) — asset URLs need this
  // subpath prefix or they 404 once deployed. Set unconditionally (not just
  // for `vite build`): `vite preview` serves the already-built dist/ files
  // using its OWN base, which must match what's baked into them, or asset
  // requests 404 (preview then masks that as a 200 by falling back to
  // index.html for the unmatched path, which is a confusing failure mode if
  // this regresses — check for that first). `vite dev` serves everything
  // under this same subpath locally too, which is intentional consistency,
  // not a side effect.
  base: '/weight-trackerV2/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/tests/integration/**'],
  },
})
