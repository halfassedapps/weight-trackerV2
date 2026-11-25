import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGistWrite } from '../../../src/hooks/useGistWrite';

const GIST_FILE = 'weight-data.json';

function authedReadResponse(payload: object) {
  return { ok: true, json: async () => ({ files: { [GIST_FILE]: { content: JSON.stringify(payload) } } }) };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useGistWrite', () => {
  it('throws (via the mutation) when called while logged out', async () => {
    const client = new QueryClient();
    const { result } = renderHook(() => useGistWrite(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });

    await act(async () => {
      await expect(result.current.mutateAsync((c) => c)).rejects.toThrow('Not logged in');
    });
  });

  it('writes via the authenticated PAT and pushes the result into the gist query cache', async () => {
    localStorage.setItem('weight-tracker-gist-pat', 'ghp_test');
    const current = { goalLbs: 155, savedAt: 'A' };
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(authedReadResponse(current)); // initial read
    fetchMock.mockResolvedValueOnce(authedReadResponse(current)); // retry check, unchanged
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '' }); // PATCH
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient();
    const { result } = renderHook(() => useGistWrite(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });

    // Wait for useAuth's own query (reading the PAT from localStorage) to
    // settle before writing — same as the real UI, which only shows admin
    // write controls once isAdmin is true.
    await waitFor(() => expect(client.getQueryData(['auth', 'pat'])).toBe('ghp_test'));

    await act(async () => {
      await result.current.mutateAsync((c) => ({ ...c, goalLbs: 160 }));
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cached = client.getQueryData(['gist', 'anonymous']) as { goalLbs: number };
    expect(cached.goalLbs).toBe(160);
  });
});
