// Replaces V1's progress.html + index.html's ?share=1 iframe trick
// (progress.html, index.html:9188, 10006-10040) with a real route. V1 needed
// the iframe because index.html was a single file that had to conditionally
// render a stripped-down view of itself; V2 is already a real multi-route
// SPA, so this is just another page — no iframe, no postMessage height sync.
//
// isAdmin is forced off here regardless of the viewer's own auth state
// (WeightChart's forceViewOnly), even on the owner's own device: this URL is
// meant to be pasted into a chat, so it must never expose editing, and the
// dose-colored line is flattened so a public link never implies a dosing
// history. The "Full tracker" link is real auth state, though — it's just a
// convenience for the owner to get back to the admin app, never shown to
// anyone else.
import { Link } from 'react-router-dom';
import { WeightChart } from '../components/charts/WeightChart';
import { useAuth } from '../hooks/useAuth';

export function SharePage() {
  const { isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="px-3 py-4">
        <div className="flex items-center justify-between px-1 pb-3">
          <div className="text-xl font-bold tracking-tight text-slate-900">Weight Progress</div>
          {isAdmin && (
            <Link to="/" className="text-[13px] font-semibold text-blue-600">
              Full tracker →
            </Link>
          )}
        </div>
        <WeightChart forceViewOnly />
      </div>
    </div>
  );
}
