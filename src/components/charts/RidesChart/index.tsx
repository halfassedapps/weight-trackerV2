// Ported from V1's RidesChart (index.html:2698-2900ish) — duration/day bar
// chart fed by intervalsActivities.ridesMap (watcher-only, pass-through).
// Deliberately smaller than V1's: graph view only, see useRidesSeries.ts.
import { useRef, useState } from 'react';
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
import type { RideActivity } from '../../../lib/gist/types';

function rideLabel(r: RideActivity) {
  return r.sport && r.sport !== 'Ride' && r.sport !== 'VirtualRide' ? `${r.sport} · ${r.name}` : r.name;
}

function activityUrl(id: RideActivity['id'] | undefined) {
  if (!id) return null;
  const idStr = String(id);
  return `https://intervals.icu/activities/${idStr.startsWith('i') ? idStr : `i${idStr}`}`;
}

function fmtDur(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function RidesChart() {
  const { data: gist, isLoading, error } = useGistData();
  const range = useRangePicker('rides', 30);
  const { mode, setMode } = useViewMode('rides', 'table');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const series = useRidesSeries(gist, range);
  const svgRef = useRef<SVGSVGElement>(null);
  const { shareChart, downloadChart, isSharing, isDownloading } = useChartPngExport(svgRef, {
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

      {mode === 'table' ? (
        <Table points={series.points} />
      ) : (
        <Chart svgRef={svgRef} series={series} selectedDate={selectedDate} onSelectDate={(d) => setSelectedDate((cur) => (cur === d ? null : d))} />
      )}

      {/* Ride cards — visible after clicking a bar (graph view only; the
          table view already lists every ride individually when expanded). */}
      {mode === 'graph' &&
        selectedDate &&
        (() => {
          const day = series.points.find((p) => p.date === selectedDate);
          if (!day) return null;
          return (
            <div className="px-3.5 pt-2 pb-3 border-t border-black/[.06]">
              <div className="text-[11px] font-semibold text-slate-400 mb-2">
                {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div className="flex flex-col gap-2">
                {day.rides.map((r, i) => {
                  const url = activityUrl(r.id);
                  return (
                    <div key={r.id ?? i} className="rounded-[10px] bg-slate-50 p-2.5">
                      <div className="text-[13px] font-semibold text-slate-900 mb-0.5">{rideLabel(r)}</div>
                      <div className="text-[11px] text-slate-400 mb-2">
                        {fmtDur(r.durSecs)} · {(r.distM / 1609.34).toFixed(1)} mi · {Math.round(r.cal)} cal
                        {r.pwr ? ` · ${Math.round(r.pwr)}W` : ''}
                        {r.hr ? ` · ${Math.round(r.hr)} bpm` : ''}
                      </div>
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg px-3 py-1.5 no-underline"
                        >
                          Open on Intervals.icu ↗
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

      <ChartShareButton onShare={shareChart} onDownload={downloadChart} isSharing={isSharing} isDownloading={isDownloading} />
    </Card>
  );
}
