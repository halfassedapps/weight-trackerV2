import { useRef, useState } from 'react';
import { Card } from '../../Card';
import { ChartLegendSwatch } from '../shared/ChartLegendSwatch';
import { ChartShareButton } from '../shared/ChartShareButton';
import { RangePickerSelect } from '../shared/RangePickerSelect';
import { Stat } from '../shared/Stat';
import { useGistData } from '../../../hooks/useGistData';
import { useRangePicker } from '../../../hooks/useRangePicker';
import { useChartPngExport } from '../../../hooks/useChartPngExport';
import { safeSetItem } from '../../../lib/storage';
import { Chart } from './Chart';
import { usePkSeries } from './usePkSeries';

const SPLIT_MANUAL_KEY = 'weight-tracker-v2:pk:splitManual';

export function PkChart() {
  const { data: gist, isLoading, error } = useGistData();
  const range = useRangePicker('pk', 30);
  const [splitManual, setSplitManual] = useState(() => localStorage.getItem(SPLIT_MANUAL_KEY) === 'true');
  const series = usePkSeries(gist, range, splitManual);
  const svgRef = useRef<SVGSVGElement>(null);

  const toggleSplit = () => {
    const next = !splitManual;
    setSplitManual(next);
    safeSetItem(SPLIT_MANUAL_KEY, String(next));
  };

  const { shareChart, isSharing } = useChartPngExport(svgRef, {
    title: 'Tirzepatide · Drug on Board',
    subtitleLines: series
      ? [
          `On board now: ${series.curLevel.toFixed(2)} mg · Weekly dose: ${Math.round(series.weeklyDose * 10) / 10} mg`,
          `Trough: ${series.troughLevel.toFixed(2)} mg · ${new Date(series.nextInjMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        ]
      : [],
    filename: 'tirz-on-board.png',
    width: 360,
    height: 190,
  });

  if (isLoading) return <p className="p-6 text-center text-sm text-slate-400">Loading…</p>;
  if (error) return <p className="p-6 text-center text-sm text-red-600">Failed to load: {(error as Error).message}</p>;
  if (!gist || !series) return null;

  return (
    <Card>
      <div className="flex items-center gap-2 px-3 pt-2 flex-wrap">
        <RangePickerSelect days={range.days} onChange={range.setDays} />
        {!series.scheduleActive && (
          <label className="ml-auto flex items-center gap-1 text-[10.5px] font-semibold text-slate-600">
            <input type="checkbox" checked={splitManual} onChange={toggleSplit} />
            Split into 2x/week
          </label>
        )}
      </div>

      <Chart svgRef={svgRef} series={series} />

      <div className="flex gap-3 px-3 pt-2 text-xs flex-wrap">
        <Stat label="On board now" value={`${series.curLevel.toFixed(2)} mg`} color="#2563eb" />
        <Stat
          label="Pre-dose trough"
          value={`${series.troughLevel.toFixed(2)} mg`}
          note={`(${new Date(series.nextInjMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`}
        />
        <Stat label="Half-life" value="5 days" />
      </div>
      <div className="flex gap-3 px-3 pt-1 pb-2 text-xs flex-wrap">
        <Stat label="Avg on board (period)" value={`${series.avgOnBoard.toFixed(2)} mg`} color="#2563eb" />
        <Stat
          label="Weight change (period)"
          value={series.periodWeightChange != null ? `${series.periodWeightChange <= 0 ? '↓' : '↑'} ${Math.abs(series.periodWeightChange).toFixed(1)} lbs` : '—'}
          color={series.periodWeightChange != null && series.periodWeightChange <= 0 ? '#16a34a' : '#dc2626'}
        />
      </div>

      {series.maintMarkers.length > 0 && (
        <div className="flex justify-center pb-1 text-[10px] text-slate-500">
          <ChartLegendSwatch color="#8e8e93" label="Maintenance toggle" dashed />
        </div>
      )}

      <ChartShareButton onClick={shareChart} isSharing={isSharing} />
    </Card>
  );
}
