// Wraps lib/gist/client.ts's writeGist with the app's two pieces of shared
// state: the admin PAT (useAuth) and the anonymous-read query cache
// (useGistData) every view-only chart renders from. A successful write
// pushes its result straight into that cache via setQueryData instead of
// waiting on a refetch — the anonymous endpoint is a cache-busted raw-URL
// fetch, but GitHub's CDN in front of it can still lag a live write by a
// few seconds, so relying on a refetch here would show the admin their own
// edit "revert" for a moment.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { writeGist } from '../lib/gist/client';
import type { GistPayload } from '../lib/gist/types';
import { useAuth } from './useAuth';

export function useGistWrite() {
  const { pat } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mutate: (current: GistPayload) => GistPayload) => {
      if (!pat) throw new Error('Not logged in.');
      return writeGist(pat, mutate);
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['gist', 'anonymous'], next);
    },
  });
}
