# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # local dev server, http://localhost:5173
npm run build        # tsc -b (type-check) && vite build -> dist/
npm test             # unit/component tests (Vitest), single run
npm run test:watch   # Vitest in watch mode
npx vitest run <path-to-test-file>   # a single test file
npm run lint         # oxlint — must exit 0 before calling anything done
npm run preview -- --port <port>     # serve the production build locally (for manual/Playwright checks)
npm run test:e2e     # Playwright integration tests — build + preview first
```

`oxlint` currently reports a set of pre-existing `react(purity)` / `react(set-state-in-effect)` /
`react(immutability)` warnings (impure `Date`/`Math.random` calls during render, etc.) that are
accepted as-is — they don't fail the lint (exit code stays 0). Don't "fix" these opportunistically;
only touch them if a change you're making is already in that exact code. Treat any *new* warning
category, or `lint` exiting non-zero, as a real regression to fix.

## Architecture

This is a from-scratch Vite/React/TS rewrite of `halfassedapps/Weight-Tracker` ("V1" — a single
10,000+ line `index.html`, no build step, no tests, deployed from its `github-pages-gist` branch).
V1 keeps running indefinitely; this is not a migration-in-place. Full rationale: `README.md`.

**The only integration surface between V1 and V2 is one shared GitHub Gist** (ID in
`src/lib/gist/client.ts`, file `weight-data.json`) that both apps — plus a Python watcher and an MCP
server that live only in the V1 repo — read and write. Neither repo depends on the other's code,
build, or deploy.

**Full-file PATCH semantics (read this before touching `src/lib/gist/`):** every Gist write replaces
the *entire* file. Any field a write doesn't carry forward gets silently deleted, not left alone —
this already caused a real production bug once (V1's watcher dropped `maintenanceDriftLbs` on every
sync until it was added to its pass-through list). `normalizeGistPayload` (`src/lib/gist/validate.ts`)
exists specifically to make every write schema-complete by construction, and `writeGist`
(`src/lib/gist/client.ts`) re-fetches and retries before patching, mirroring the watcher's own
conflict-avoidance, since the watcher, V1, and V2 can all write concurrently. **If you add a new Gist
field:** update `types.ts` and `validate.ts`, and confirm V1 + the watcher either write it or pass it
through unchanged — otherwise V2 writing it works until the watcher's next run quietly deletes it.

**`src/lib/domain/` is pure business logic ported from V1**, almost always with a code comment
pointing at the exact `index.html:<line>` it was ported from. When fixing a bug or porting a missing
feature, check that comment and read the V1 source first rather than re-deriving the logic — V1's
dosing/TDEE math in particular has a history of subtle off-by-small-amounts bugs, so matching it
exactly (not "improving" it independently) is usually the correct move unless the user asks otherwise.

**Shared hooks replace what was independently duplicated 5–8× across V1's chart components:**
`useRangePicker` (range-picker + custom start/end date state, localStorage-persisted),
`useChartPngExport` (separate `downloadChart`/`shareChart` actions — a share sheet alone doesn't
reliably expose "save", so both exist independently), `useViewMode` (graph/table toggle, persisted),
`useGistData`/`useGistWrite` (React Query read + the full-PATCH-safe write described above), `useAuth`
(admin = has a GitHub PAT in localStorage). Every `*Chart/index.tsx` is a thin container wiring these
hooks together; a `use<Name>Series.ts` beside it does the actual data shaping, and `Chart.tsx`/
`Table.tsx` just render whatever that hook returns. New charts should follow this same split rather
than inlining state/derivation into the component.

**`localStorage` is shared with V1 on purpose.** Both apps are served from `halfassedapps.github.io`
(different *paths*, same *origin*), and `localStorage` is origin-scoped, not path-scoped. A few
view-preference keys (e.g. sticky measured-TDEE, vial/syringe size) deliberately reuse V1's exact
literal key strings instead of a V2-prefixed duplicate, specifically so the two apps stay in sync
without an explicit migration step. Don't "clean up" these into namespaced keys — that would silently
desync the two apps for anyone with existing V1 data.

**Chart SVGs share one coordinate convention:** a fixed logical `viewBox="0 0 360 <H>"`, scaled to the
container via CSS (`width: 100%`), not real pixel dimensions. Hover tooltips/popovers are positioned
in this same logical space. When a popover can render near a chart's edge, give it a background `rect`
sized from an estimated text width (SVG can't measure text without a DOM round-trip) and clamp its
position to stay inside the chart's own bounds — several past bugs here were an unclamped popover
running outside the SVG, or outside the browser viewport entirely on a wide screen.

**Deploy:** `.github/workflows/deploy.yml` builds and runs tests on every push to `main`, then deploys
`dist/` straight to GitHub Pages — there's no separate staging environment or manual approval step.
`vite.config.ts`'s `base` must match the GitHub Pages path this repo is actually served from, or every
asset request 404s post-deploy.

## Coding principles for this repo

- **DRY, actively.** If you're about to write the third copy of some state/derivation/rendering
  pattern, that's the signal to extract a shared hook or component first (see the hooks list above —
  that's exactly how they came to exist). Don't let a pattern get to a fourth or fifth copy before
  consolidating.
- **One responsibility per file.** `use<X>Series.ts` derives data; `Chart.tsx`/`Table.tsx` render it;
  `index.tsx` wires hooks together. Don't fold derivation logic into a render component, or vice versa
  — it's the main thing that made V1's `WeightChart` (1,834 lines) and `App` (1,575 lines, 50
  `useState` calls) unmaintainable, and both are called out in the original project plan as the two
  files to watch for the same thing recurring here.
- **No speculative abstraction.** Two similar call sites can stay duplicated; don't generalize until a
  third one actually shows up with the same shape. A one-off UI doesn't need a config object or a
  plugin point "in case" another chart needs it later.
- **Trust the type system over defensive checks.** `GistPayload` and `normalizeGistPayload` already
  guarantee a schema-complete, well-typed payload — don't add runtime null-checks or fallbacks for
  shapes those already rule out. Reach for real optionality (`?`/`| null` in `types.ts`) instead of an
  informal "empty string means absent" convention.
- **Match V1's behavior deliberately, diverge deliberately.** When porting a feature, matching V1
  exactly is the default; a conscious simplification (V2 has made several, e.g. no CSV auto-import
  from a watched folder) should be called out as such, not silently dropped.

## Verification before calling anything done

This codebase has real tests and a real build — use them. Before reporting a change complete:
1. `npm run build` (type-check + production build)
2. `npm test` (Vitest)
3. `npm run lint` (must exit 0)
4. For anything visual or interactive: build, `npm run preview`, and actually look at it (a
   screenshot tool, e.g. Playwright) against real data from the shared Gist — type-checking and unit
   tests verify code correctness, not feature correctness.
5. After deploying: confirm the GitHub Actions run succeeded, then spot-check the live routes for
   console errors.

## Environment notes

- The Node.js binary used in this project's shell may live at a non-standard path
  (`/Users/miesemer/.local/node/bin/node`) not on the default `PATH` — prepend
  `export PATH="/Users/miesemer/.local/node/bin:$PATH"` before `npm`/`node`/`npx` commands if they
  fail with a "command not found".
