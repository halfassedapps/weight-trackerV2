import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { AdminLogin } from './components/AdminLogin';
import { InjectionDayBanner } from './components/InjectionDayBanner';
import { useAuth } from './hooks/useAuth';
import { WeightPage } from './pages/WeightPage';
import { BpPage } from './pages/BpPage';
import { DosingPage } from './pages/DosingPage';
import { NutritionPage } from './pages/NutritionPage';
import { ActivityPage } from './pages/ActivityPage';
import { VideosPage } from './pages/VideosPage';
import { SharePage } from './pages/SharePage';

const queryClient = new QueryClient();

const tabLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`;

// Thin shell per the project plan — Gist access lives in hooks (useGistData/
// useGistWrite), tab/page content lives in pages/, this just wires providers
// + routing. /share renders its own standalone layout (see SharePage) — no
// tabs, no admin chrome, meant to be pasted into a chat — so the usual
// header/nav is skipped for it here rather than duplicated inside the page.
function AppShell() {
  const { pathname } = useLocation();
  const { isAdmin } = useAuth();
  const isShare = pathname.startsWith('/share');

  return (
    <>
      {!isShare && (
        <header className="border-b border-slate-200 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Weight Tracker</h1>
              {isAdmin && (
                <Link to="/share" target="_blank" rel="noopener" className="text-xs font-semibold text-blue-600">
                  Share progress →
                </Link>
              )}
            </div>
            <AdminLogin />
          </div>
          <nav className="mt-2 flex gap-2">
            <NavLink to="/" end className={tabLinkClass}>
              Weight
            </NavLink>
            <NavLink to="/bp" className={tabLinkClass}>
              Blood Pressure
            </NavLink>
            <NavLink to="/dosing" className={tabLinkClass}>
              Dosing
            </NavLink>
            <NavLink to="/nutrition" className={tabLinkClass}>
              Nutrition
            </NavLink>
            <NavLink to="/activity" className={tabLinkClass}>
              Activity
            </NavLink>
            <NavLink to="/videos" className={tabLinkClass}>
              Progress Videos
            </NavLink>
          </nav>
        </header>
      )}
      {!isShare && (
        <div className="px-3 pt-3">
          <InjectionDayBanner />
        </div>
      )}
      <Routes>
        <Route path="/" element={<WeightPage />} />
        <Route path="/bp" element={<BpPage />} />
        <Route path="/dosing" element={<DosingPage />} />
        <Route path="/nutrition" element={<NutritionPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/videos" element={<VideosPage />} />
        <Route path="/share" element={<SharePage />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
