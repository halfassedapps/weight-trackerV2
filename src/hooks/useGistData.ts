import { useQuery } from '@tanstack/react-query';
import { readGistAnonymous } from '../lib/gist/client';

/**
 * Anonymous (read-only) Gist data — what every non-admin view uses. Admin
 * surfaces add their own authenticated read/write hooks on top of this in a
 * later phase; this one never needs a PAT.
 */
export function useGistData() {
  return useQuery({
    queryKey: ['gist', 'anonymous'],
    queryFn: readGistAnonymous,
    staleTime: 60_000,
  });
}
