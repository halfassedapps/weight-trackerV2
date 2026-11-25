// Reads/writes the exact same Gist V1 (halfassedapps/Weight-Tracker) and its
// Python watcher (watcher/weight_export_watcher.py) use. See types.ts for the
// schema this round-trips and validate.ts for the normalization every read
// and write goes through.
import { normalizeGistPayload } from './validate';
import type { GistPayload, RawGistPayload } from './types';

export const GIST_ID = 'aa6e7ae2259f94c7a91637b447a0cd99';
export const GIST_USER = 'halfassedapps';
const GIST_FILE = 'weight-data.json';

/**
 * Anonymous, unauthenticated read via the raw Gist URL — works for a secret
 * Gist without a token, same endpoint V1 uses for view-only visitors. Powers
 * the share view and any other read-only surface.
 */
export async function readGistAnonymous(): Promise<GistPayload> {
  const url = `https://gist.githubusercontent.com/${GIST_USER}/${GIST_ID}/raw/${GIST_FILE}?t=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Gist fetch failed: ${res.status}`);
  const raw = (await res.json()) as RawGistPayload;
  return normalizeGistPayload(raw);
}

interface GistApiFile {
  content?: string;
}
interface GistApiResponse {
  files?: Record<string, GistApiFile>;
}

async function fetchGistRaw(pat: string): Promise<RawGistPayload> {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    cache: 'no-store',
    headers: {
      Authorization: `token ${pat}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) throw new Error(`Gist fetch failed: ${res.status}`);
  const gist = (await res.json()) as GistApiResponse;
  const content = gist.files?.[GIST_FILE]?.content;
  if (!content) throw new Error(`Gist file ${GIST_FILE} not found or empty.`);
  return JSON.parse(content) as RawGistPayload;
}

/** Authenticated read — admin only (needs a GitHub PAT with `gist` scope). */
export async function readGistAuthenticated(pat: string): Promise<GistPayload> {
  const raw = await fetchGistRaw(pat);
  return normalizeGistPayload(raw);
}

async function patchGistRaw(pat: string, payload: GistPayload): Promise<void> {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `token ${pat}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(payload, null, 2) } } }),
  });
  if (!res.ok) throw new Error(`Gist write failed: ${res.status} ${await res.text()}`);
}

export interface WriteGistOptions {
  maxAttempts?: number;
}

/**
 * Every write is a full-file PATCH — anything `mutate` doesn't carry forward
 * gets deleted from the Gist, not left alone (see types.ts's GistPayload
 * doc comment). `mutate` always receives the full current payload and must
 * return a full payload, so there's one place a dropped field would have to
 * happen, not scattered across call sites.
 *
 * Mirrors watcher/weight_export_watcher.py's `fetch_build_and_patch` exactly:
 * a live client (this app, another browser tab, or the watcher itself) can
 * write to the Gist between our own fetch and our eventual patch. Re-fetch
 * immediately before patching and rebuild against whatever's actually there
 * if `savedAt` changed, retrying up to `maxAttempts` times, so the final
 * patch is built from state verified current as of just before we send it.
 * (This doesn't eliminate the race at the final instant — same caveat the
 * watcher's own comment calls out — just narrows the window a lot.)
 */
export async function writeGist(
  pat: string,
  mutate: (current: GistPayload) => GistPayload,
  opts: WriteGistOptions = {},
): Promise<GistPayload> {
  const maxAttempts = opts.maxAttempts ?? 4;

  let current = await readGistAuthenticated(pat);
  let next = normalizeGistPayload({ ...mutate(current), savedAt: new Date().toISOString() });

  for (let i = 0; i < maxAttempts; i++) {
    const fresh = await readGistAuthenticated(pat);
    if (fresh.savedAt === current.savedAt) break;
    current = fresh;
    next = normalizeGistPayload({ ...mutate(current), savedAt: new Date().toISOString() });
  }

  await patchGistRaw(pat, next);
  return next;
}
