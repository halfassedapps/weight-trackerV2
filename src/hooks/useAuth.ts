// Admin auth — same model as V1 (index.html's AdminLogin/GistPanel): a
// GitHub Personal Access Token with `gist` scope, held in localStorage,
// never sent anywhere but api.github.com. `isAdmin` is just "a token is
// present"; the token's validity is only actually checked by `login`
// (verified against the live Gist) and by whatever write eventually uses it.
//
// Backed by the TanStack Query cache (not component-local state) so every
// consumer — the header's login control, an admin-only chart editor, etc. —
// observes the same value and re-renders together on login/logout, the same
// way useGistData's query already fans out gist reads to every chart.
import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { readGistAuthenticated } from '../lib/gist/client';
import { safeRemoveItem, safeSetItem } from '../lib/storage';

const LS_GIST_PAT_KEY = 'weight-tracker-gist-pat';
const PAT_QUERY_KEY = ['auth', 'pat'] as const;

export type LoginStatus = 'idle' | 'verifying' | 'error';

export interface UseAuthResult {
  isAdmin: boolean;
  pat: string | null;
  status: LoginStatus;
  error: string | null;
  login: (rawPat: string) => Promise<boolean>;
  logout: () => void;
}

export function useAuth(): UseAuthResult {
  const queryClient = useQueryClient();
  const { data: pat } = useQuery({
    queryKey: PAT_QUERY_KEY,
    queryFn: () => localStorage.getItem(LS_GIST_PAT_KEY),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(
    async (rawPat: string): Promise<boolean> => {
      const trimmed = rawPat.trim();
      if (!trimmed) return false;
      setStatus('verifying');
      setError(null);
      try {
        // A real Gist read is the verification — a bad/expired/wrong-scope
        // token fails here with a clear error instead of silently "logging
        // in" and only failing much later on the first write attempt.
        await readGistAuthenticated(trimmed);
        // A write that fails to persist (private browsing, quota) still
        // leaves this session logged in via the query cache — it just won't
        // survive a reload. Not folded into the try above: a persistence
        // failure here must never be reported as "Login failed", since the
        // token itself was already confirmed valid by the read above.
        safeSetItem(LS_GIST_PAT_KEY, trimmed);
        queryClient.setQueryData(PAT_QUERY_KEY, trimmed);
        setStatus('idle');
        return true;
      } catch (e) {
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Login failed');
        return false;
      }
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    safeRemoveItem(LS_GIST_PAT_KEY);
    queryClient.setQueryData(PAT_QUERY_KEY, null);
    setStatus('idle');
    setError(null);
  }, [queryClient]);

  return { isAdmin: !!pat, pat: pat ?? null, status, error, login, logout };
}
