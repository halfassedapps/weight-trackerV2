import { useRef } from 'react';
import { Card } from '../../Card';
import { ChartLegendSwatch } from '../shared/ChartLegendSwatch';
import { ChartShareButton } from '../shared/ChartShareButton';
import { RangePickerSelect } from '../shared/RangePickerSelect';
import { Stat } from '../shared/Stat';
import { useGistData } from '../../../hooks/useGistData';
import { useRangePicker } from '../../../hooks/useRangePicker';
import { useChartPngExport } from '../../../hooks/useChartPngExport';
import { BP_DIA_COLOR, BP_SYS_COLOR } from '../../../lib/domain/bloodPressure';
import { Chart } from './Chart';
import { useBpSeries } from './useBpSeries';

export function BpChart() {
  const { data: gist, isLoading, error } = useGistData();
  const range = useRangePicker('bp', 90);
  const series = useBpSeries(gist, range);
  const svgRef = useRef<SVGSVGElement>(null);
  const { shareChart, isSharing } = useChartPngExport(svgRef, {
    title: 'Blood Pressure',
    subtitleLines: [
      `Avg ${series.avgSys != null ? Math.round(series.avgSys) : '—'}/${series.avgDia != null ? Math.round(series.avgDia) : '—'} mmHg`,
    ],
    filename: 'blood-pressure.png',
    width: 360,
    height: 180,
  });

  if (isLoading) return <p className="p-6 text-center text-sm text-slate-400">Loading…</p>;
  if (error) return <p className="p-6 text-center text-sm text-red-600">Failed to load: {(error as Error).message}</p>;
  if (!gist) return null;

  return (
    <Card>
      <div className="flex items-center gap-2 px-3 pt-2">
        <RangePickerSelect days={range.days} onChange={range.setDays} />
      </div>

      <div className="flex gap-4 px-3 py-2 text-xs">
        <Stat label="Avg systolic" value={series.avgSys != null ? `${Math.round(series.avgSys)} mmHg` : '—'} color="#e05252" />
        <Stat label="Avg diastolic" value={series.avgDia != null ? `${Math.round(series.avgDia)} mmHg` : '—'} color="#4a90d9" />
        <Stat label="Readings" value={String(series.points.reduce((s, p) => s + p.readings.length, 0))} />
      </div>

      <Chart svgRef={svgRef} series={series} />

      <div className="flex items-center justify-center gap-3 px-3 py-2 text-[10px] text-slate-500">
        <ChartLegendSwatch color={BP_SYS_COLOR} label="Systolic" />
        <ChartLegendSwatch color={BP_DIA_COLOR} label="Diastolic" />
        {series.maintMarkers.length > 0 && <ChartLegendSwatch color="#8e8e93" label="Maintenance toggle" dashed />}
      </div>

      <ChartShareButton onClick={shareChart} isSharing={isSharing} />
    </Card>
  );
}
