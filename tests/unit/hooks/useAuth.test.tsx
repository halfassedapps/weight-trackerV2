import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../../src/hooks/useAuth';

const LS_KEY = 'weight-tracker-gist-pat';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useAuth', () => {
  it('starts logged out with no stored token', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.pat).toBe(null));
    expect(result.current.isAdmin).toBe(false);
  });

  it('logs in on a token that verifies against the live gist, and persists it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ files: { 'weight-data.json': { content: '{}' } } }),
      }),
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      const ok = await result.current.login('ghp_test123');
      expect(ok).toBe(true);
    });

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.pat).toBe('ghp_test123');
    expect(localStorage.getItem(LS_KEY)).toBe('ghp_test123');
  });

  it('rejects a token that fails verification, without persisting it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      const ok = await result.current.login('bad-token');
      expect(ok).toBe(false);
    });

    expect(result.current.isAdmin).toBe(false);
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeTruthy();
    expect(localStorage.getItem(LS_KEY)).toBeNull();
  });

  it('logs out, clearing both the cache and localStorage', async () => {
    localStorage.setItem(LS_KEY, 'existing-token');
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAdmin).toBe(true));

    act(() => result.current.logout());

    expect(result.current.isAdmin).toBe(false);
    expect(localStorage.getItem(LS_KEY)).toBeNull();
  });
});
