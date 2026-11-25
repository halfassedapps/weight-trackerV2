// Ported from V1's AdminLogin (index.html:7990-8032): a collapsed text
// trigger that opens into a PAT input, verified live against the Gist
// before being stored (see useAuth.login).
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export function AdminLogin() {
  const { isAdmin, status, error, login, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [pat, setPat] = useState('');

  if (isAdmin) {
    return (
      <button
        type="button"
        onClick={logout}
        className="text-xs font-medium text-slate-400 hover:text-red-500"
      >
        Log out
      </button>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-slate-300 hover:text-slate-400">
        Admin Login
      </button>
    );
  }

  const submit = async () => {
    const ok = await login(pat);
    if (ok) {
      setOpen(false);
      setPat('');
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm">
      <div className="mb-2 text-xs font-semibold text-slate-900">Admin Login</div>
      <input
        type="password"
        value={pat}
        onChange={(e) => setPat(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="Personal Access Token"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        autoComplete="off"
        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-xs"
      />
      {status === 'error' && error && <div className="mt-1.5 text-[11px] text-red-500">{error}</div>}
      {status === 'verifying' && <div className="mt-1.5 text-[11px] text-slate-400">Verifying…</div>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setPat('');
          }}
          className="flex-1 rounded-lg bg-slate-100 py-1.5 text-xs font-medium text-slate-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!pat || status === 'verifying'}
          className="flex-1 rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          Log in
        </button>
      </div>
    </div>
  );
}
