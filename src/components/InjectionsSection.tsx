// Shows either the dose graph (DoseChart) or the injection log (table) —
// never both at once, matching V1's single "Injections" card with its own
// Table/Graph toggle (index.html:10488-10498). Each already owns a full
// Card; this just decides which one is mounted; swapping them on toggle
// is pragmatic.
import { DoseChart } from './charts/DoseChart';
import { GraphTableToggle } from './charts/shared/GraphTableToggle';
import { InjectionLogCard } from './InjectionLogCard';
import { useViewMode } from '../hooks/useViewMode';

export function InjectionsSection() {
  const { mode, setMode } = useViewMode('dosing-injections', 'table');
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-1">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Injections</div>
        <GraphTableToggle mode={mode} onChange={setMode} />
      </div>
      {mode === 'graph' ? <DoseChart /> : <InjectionLogCard />}
    </div>
  );
}
