import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { readGistAnonymous } from './lib/gist/client';

const queryClient = new QueryClient();

// Placeholder shell for Phase 0 — just proves the Gist data layer works
// end-to-end against the live Gist. Real routing/pages/charts land in later
// phases (see the project plan).
function GistSmokeTest() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['gist', 'anonymous'],
    queryFn: readGistAnonymous,
  });

  if (isLoading) return <p className="text-slate-500">Loading Gist data…</p>;
  if (error) return <p className="text-red-600">Failed to load: {(error as Error).message}</p>;

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
      <dt className="text-slate-500">Weight entries</dt>
      <dd>{data?.entries.length}</dd>
      <dt className="text-slate-500">Injections</dt>
      <dd>{data?.injections.length}</dd>
      <dt className="text-slate-500">Goal (lbs)</dt>
      <dd>{data?.goalLbs}</dd>
      <dt className="text-slate-500">Maintenance range (± lbs)</dt>
      <dd>{data?.maintenanceDriftLbs}</dd>
    </dl>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-xl font-semibold text-slate-900">Weight Tracker V2</h1>
        <p className="mt-1 text-sm text-slate-500">
          Phase 0 scaffold — reads the same Gist as the production app.
        </p>
        <div className="mt-6 rounded-lg border border-slate-200 p-4">
          <GistSmokeTest />
        </div>
      </main>
    </QueryClientProvider>
  );
}

export default App;
