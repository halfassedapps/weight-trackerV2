# Weight Tracker V2

A clean Vite + React + TypeScript rewrite of [halfassedapps/Weight-Tracker](https://github.com/halfassedapps/Weight-Tracker) ("V1" below) — a personal weight/GLP-1-dosing/nutrition tracker.

## Relationship to V1

This is a **from-scratch rewrite in an isolated repo**, not a fork or a migration-in-place. V1 keeps running exactly as it is, indefinitely:

- V1 is a single 10,000+ line `index.html` (React via UMD `<script>` tags + Babel-standalone, zero build step, zero tests), deployed by pushing straight to its `github-pages-gist` branch.
- V2 (this repo) is a normal Vite/TS app with real tests and a real build, deployed independently via GitHub Actions to its own GitHub Pages site.
- **Both apps read and write the exact same GitHub Gist** (`weight-data.json`, ID in `src/lib/gist/client.ts`) — that's the entire integration surface between them. Neither repo depends on the other's code, build, or deploy.
- V1's Python watcher (`watcher/weight_export_watcher.py`, scheduled via launchd) and its MCP server stay in the V1 repo, untouched. V2 never talks to them directly, only to the Gist they also write to.

See the project plan (shared with the user, not checked into this repo) for the full architecture rationale and phasing. Short version: `src/lib/gist/` is the data contract both apps must agree on; everything there is a deliberate port of V1's `parseGistPayload`/`patchGist` logic (index.html:669-807), typed and tested.

## ⚠️ Full-file PATCH semantics — read before touching `src/lib/gist/`

Every Gist write **replaces the entire file**. A field `writeGist`'s `mutate` callback doesn't carry forward in the payload it returns gets **deleted from the Gist**, not left alone — this already bit V1's own watcher once (a field was silently reset on every sync until it was added to the pass-through list). `normalizeGistPayload` (`src/lib/gist/validate.ts`) exists specifically so every write is schema-complete by construction, and `writeGist` (`src/lib/gist/client.ts`) re-fetches and retries before patching (mirroring the watcher's own race-avoidance) since the watcher, V1, and V2 can all write concurrently. If you add a new Gist field, update `types.ts`, `validate.ts`, **and** confirm V1 + the watcher either write it or pass it through unchanged — otherwise V2 writing it will work until the watcher's next run quietly deletes it.

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · React Router · TanStack Query · Vitest + React Testing Library (unit/component) · Playwright (integration, against `vite preview`)

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit/component tests (Vitest)
npm run test:e2e   # integration tests (Playwright, run `npm run build && npm run preview` first)
npm run build      # tsc type-check + production build to dist/
```

## Project layout

```
src/
  lib/gist/      # the Gist data contract: types, defaults, validation, read/write client
  lib/domain/     # pure business logic ported from V1 (CSV parsing, dosing math, TDEE, ranges)
  hooks/          # shared chart hooks (range picker, PNG export, nearest-point tooltip, Gist data)
  components/     # charts/, panels/, layout/
  pages/          # one per tab/route
tests/
  unit/           # Vitest, mirrors src/lib/
  integration/    # Playwright
  fixtures/       # synthetic (not real) Gist-shaped sample data for tests
```
