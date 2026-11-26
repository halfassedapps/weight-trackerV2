// Ported from V1's fetchBodyScans (index.html:717-735) — body-scan progress
// videos live as files in V1's own repo (halfassedapps/Weight-Tracker,
// body-scans/ directory on the github-pages-gist branch), read anonymously
// via the public GitHub Contents API. Unrelated to this repo or the Gist;
// V2 just reads the same public listing V1 already does.
import { useQuery } from '@tanstack/react-query';

const BODY_SCANS_RE = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})(?:_(.+))?\.mp4$/i;

export interface BodyScanVideo {
  startDate: string;
  endDate: string;
  label?: string;
  url: string;
}

interface GithubContentFile {
  name: string;
  download_url: string;
}

async function fetchBodyScans(): Promise<BodyScanVideo[]> {
  const res = await fetch('https://api.github.com/repos/halfassedapps/Weight-Tracker/contents/body-scans?ref=github-pages-gist', {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });
  if (!res.ok) return [];
  const files: GithubContentFile[] = await res.json();
  return files
    .filter((f) => BODY_SCANS_RE.test(f.name))
    .map((f) => {
      const match = f.name.match(BODY_SCANS_RE)!;
      const [, startDate, endDate, rawLabel] = match;
      const label = rawLabel ? rawLabel.replace(/[-_]/g, ' ') : undefined;
      return { startDate, endDate, label, url: f.download_url };
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function useBodyScans() {
  return useQuery({
    queryKey: ['body-scans'],
    queryFn: fetchBodyScans,
    staleTime: 5 * 60_000,
  });
}
