// Ported from V1's repeated Graph/Table pill pair (e.g. index.html:10488-10498)
// — shared across WeightChart, BpChart, RidesChart, and the Dosing
// injections card, each of which had its own independent 'graph' | 'table'
// view-mode state.
export type GraphTableMode = 'graph' | 'table';

export interface GraphTableToggleProps {
  mode: GraphTableMode;
  onChange: (mode: GraphTableMode) => void;
}

export function GraphTableToggle({ mode, onChange }: GraphTableToggleProps) {
  return (
    <div className="flex bg-slate-100 rounded-lg p-0.5">
      {(['graph', 'table'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`text-[10px] font-semibold px-2.5 py-1 rounded-md capitalize ${
            mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
