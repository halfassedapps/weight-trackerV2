import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { AdminLogin } from './components/AdminLogin';
import { WeightPage } from './pages/WeightPage';
import { BpPage } from './pages/BpPage';

const queryClient = new QueryClient();

const tabLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`;

// Thin shell per the project plan — Gist access lives in hooks (useGistData/
// useGistWrite), tab/page content lives in pages/, this just wires providers
// + routing. More routes land as later phases add pages.
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <header className="border-b border-slate-200 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-lg font-semibold text-slate-900">Weight Tracker</h1>
            <AdminLogin />
          </div>
          <nav className="mt-2 flex gap-2">
            <NavLink to="/" end className={tabLinkClass}>
              Weight
            </NavLink>
            <NavLink to="/bp" className={tabLinkClass}>
              Blood Pressure
            </NavLink>
          </nav>
        </header>
        <Routes>
          <Route path="/" element={<WeightPage />} />
          <Route path="/bp" element={<BpPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
