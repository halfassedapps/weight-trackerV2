import { afterEach, describe, expect, it, vi } from 'vitest';
import { GIST_ID, readGistAnonymous, readGistAuthenticated, writeGist } from '../../../../src/lib/gist/client';
import type { GistPayload } from '../../../../src/lib/gist/types';

const GIST_FILE = 'weight-data.json';

function basePayload(overrides: Partial<GistPayload> = {}): GistPayload {
  return {
    version: 1,
    savedAt: '2026-01-01T00:00:00.000Z',
    meta: { metric: 'Weight', source: '' },
    entries: [],
    injections: [],
    injSchedule: [],
    calories: [],
    intervalsActivities: null,
    calorieTargets: [],
    proteinTargets: [],
    bloodPressure: [],
    weightAnnotations: [],
    goalLbs: 155,
    heightIn: 67,
    maintenanceDriftLbs: 2,
    maintenanceHistory: [],
    bmrProfile: null,
    ...overrides,
  };
}

function authedReadResponse(payload: GistPayload) {
  return {
    ok: true,
    json: async () => ({ files: { [GIST_FILE]: { content: JSON.stringify(payload) } } }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readGistAnonymous', () => {
  it('fetches the raw gist URL and normalizes it', async () => {
    const payload = basePayload({ goalLbs: 150 });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal('fetch', fetchMock);

    const result = await readGistAnonymous();
    expect(result.goalLbs).toBe(150);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(GIST_ID), expect.objectContaining({ cache: 'no-store' }));
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(readGistAnonymous()).rejects.toThrow('404');
  });
});

describe('readGistAuthenticated', () => {
  it('throws when the gist file is missing from the API response (e.g. a bad token with no gist access)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ files: {} }) }));
    await expect(readGistAuthenticated('bad-pat')).rejects.toThrow(GIST_FILE);
  });
});

describe('writeGist', () => {
  it('patches once when no concurrent write happened (savedAt unchanged on the retry read)', async () => {
    const current = basePayload({ goalLbs: 155, savedAt: 'A' });
    const fetchMock = vi.fn();
    // 1st read (initial), 2nd read (retry check — unchanged) both return `current`.
    fetchMock.mockResolvedValueOnce(authedReadResponse(current));
    fetchMock.mockResolvedValueOnce(authedReadResponse(current));
    // PATCH
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    const result = await writeGist('pat', (c) => ({ ...c, goalLbs: 160 }));

    expect(result.goalLbs).toBe(160);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const patchCall = fetchMock.mock.calls[2];
    expect(patchCall[1].method).toBe('PATCH');
    const sentBody = JSON.parse(patchCall[1].body);
    const sentPayload = JSON.parse(sentBody.files[GIST_FILE].content);
    expect(sentPayload.goalLbs).toBe(160);
  });

  it('rebuilds from fresh data when a concurrent write changed savedAt before the patch, retrying up to maxAttempts', async () => {
    const original = basePayload({ goalLbs: 155, savedAt: 'A' });
    // Simulates another writer (e.g. the watcher) landing a change between
    // our initial read and our retry check.
    const concurrent = basePayload({ goalLbs: 155, heightIn: 70, savedAt: 'B' });

    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(authedReadResponse(original)); // initial read
    fetchMock.mockResolvedValueOnce(authedReadResponse(concurrent)); // retry #1: savedAt changed
    fetchMock.mockResolvedValueOnce(authedReadResponse(concurrent)); // retry #2: unchanged now -> break
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '' }); // PATCH
    vi.stubGlobal('fetch', fetchMock);

    const mutate = vi.fn((c: GistPayload) => ({ ...c, goalLbs: 160 }));
    const result = await writeGist('pat', mutate, { maxAttempts: 4 });

    // Mutate must be re-run against the fresh (concurrent) payload, not the
    // stale initial one — otherwise heightIn: 70 would be lost on patch.
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(result.goalLbs).toBe(160);
    expect(result.heightIn).toBe(70);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('gives up after maxAttempts and patches with whatever it last built, if savedAt keeps changing', async () => {
    let counter = 0;
    const fetchMock = vi.fn(() => {
      counter += 1;
      return Promise.resolve(authedReadResponse(basePayload({ savedAt: `v${counter}` })));
    });
    vi.stubGlobal('fetch', fetchMock);

    // Patch call needs to be distinguished from reads — intercept by call count.
    const realFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') return Promise.resolve({ ok: true, text: async () => '' });
      return realFetch(_url, init);
    });

    const result = await writeGist('pat', (c) => ({ ...c, goalLbs: 999 }), { maxAttempts: 2 });
    expect(result.goalLbs).toBe(999);
    // initial read + 2 retry reads + 1 patch = 4 calls
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('throws if the final PATCH fails', async () => {
    const current = basePayload({ savedAt: 'A' });
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(authedReadResponse(current));
    fetchMock.mockResolvedValueOnce(authedReadResponse(current));
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, text: async () => 'conflict' });
    vi.stubGlobal('fetch', fetchMock);

    await expect(writeGist('pat', (c) => ({ ...c, goalLbs: 1 }))).rejects.toThrow('409');
  });
});
