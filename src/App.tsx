import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { WeightPage } from './pages/WeightPage';

const queryClient = new QueryClient();

// Thin shell per the project plan — Gist access lives in hooks (useGistData/
// useGistWrite), tab/page content lives in pages/, this just wires providers
// + routing. More routes land as later phases add pages.
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <header className="border-b border-slate-200 px-4 py-3">
          <h1 className="text-lg font-semibold text-slate-900">Weight Tracker</h1>
        </header>
        <Routes>
          <Route path="/" element={<WeightPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
