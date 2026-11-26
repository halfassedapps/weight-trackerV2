// Ported from V1's RidesChart (index.html:2698-2900ish) — duration/day bar
// chart fed by intervalsActivities.ridesMap (watcher-only, pass-through).
// Deliberately smaller than V1's: graph view only, see useRidesSeries.ts.
import { useRef } from 'react';
import { Card } from '../../Card';
import { ChartShareButton } from '../shared/ChartShareButton';
import { GraphTableToggle } from '../shared/GraphTableToggle';
import { RangePickerSelect } from '../shared/RangePickerSelect';
import { Stat } from '../shared/Stat';
import { useGistData } from '../../../hooks/useGistData';
import { useRangePicker } from '../../../hooks/useRangePicker';
import { useChartPngExport } from '../../../hooks/useChartPngExport';
import { useViewMode } from '../../../hooks/useViewMode';
import { Chart } from './Chart';
import { Table } from './Table';
import { useRidesSeries } from './useRidesSeries';

function fmtDur(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function RidesChart() {
  const { data: gist, isLoading, error } = useGistData();
  const range = useRangePicker('rides', 30);
  const { mode, setMode } = useViewMode('rides', 'table');
  const series = useRidesSeries(gist, range);
  const svgRef = useRef<SVGSVGElement>(null);
  const { shareChart, isSharing } = useChartPngExport(svgRef, {
    title: 'My Rides',
    subtitleLines: [`${fmtDur(series.totalDurSecs)} · ${series.totalDistMi.toFixed(1)} mi · ${Math.round(series.totalCal).toLocaleString()} cal`],
    filename: 'rides.png',
    width: 360,
    height: 140,
  });

  if (isLoading) return <p className="p-6 text-center text-sm text-slate-400">Loading…</p>;
  if (error) return <p className="p-6 text-center text-sm text-red-600">Failed to load: {(error as Error).message}</p>;
  if (!gist || !Object.keys(gist.intervalsActivities?.ridesMap ?? {}).length) return null;

  return (
    <Card title="Rides">
      <div className="flex items-center justify-between gap-2 px-3 pt-2">
        <RangePickerSelect days={range.days} onChange={range.setDays} />
        <GraphTableToggle mode={mode} onChange={setMode} />
      </div>

      <div className="grid grid-cols-3 gap-2 px-3 py-2 text-xs">
        <Stat label="Time" value={fmtDur(series.totalDurSecs)} />
        <Stat label="Distance" value={`${series.totalDistMi.toFixed(1)} mi`} />
        <Stat label="Calories" value={Math.round(series.totalCal).toLocaleString()} />
      </div>

      {mode === 'table' ? <Table points={series.points} /> : <Chart svgRef={svgRef} series={series} />}

      <ChartShareButton onClick={shareChart} isSharing={isSharing} />
    </Card>
  );
}
