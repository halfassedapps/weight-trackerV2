import { useRef, useState } from 'react';
import { Card } from '../../Card';
import { ChartLegendSwatch } from '../shared/ChartLegendSwatch';
import { ChartShareButton } from '../shared/ChartShareButton';
import { RangePickerSelect } from '../shared/RangePickerSelect';
import { useGistData } from '../../../hooks/useGistData';
import { useRangePicker } from '../../../hooks/useRangePicker';
import { useChartPngExport } from '../../../hooks/useChartPngExport';
import { safeSetItem } from '../../../lib/storage';
import { Chart } from './Chart';
import { useDoseSeries } from './useDoseSeries';

const SHOW_WEIGHT_KEY = 'weight-tracker-v2:dose:showWeight';

export function DoseChart() {
  const { data: gist, isLoading, error } = useGistData();
  const range = useRangePicker('dose', 0);
  const series = useDoseSeries(gist, range);
  const svgRef = useRef<SVGSVGElement>(null);
  const [showWeight, setShowWeight] = useState(() => localStorage.getItem(SHOW_WEIGHT_KEY) !== 'false');

  const toggleShowWeight = (v: boolean) => {
    setShowWeight(v);
    safeSetItem(SHOW_WEIGHT_KEY, String(v));
  };

  const { shareChart, downloadChart, isSharing, isDownloading } = useChartPngExport(svgRef, {
    title: 'Weekly Dose',
    subtitleLines: series ? [`Current: ${series.currentDoseMg != null ? Math.round(series.currentDoseMg * 10) / 10 : '—'} mg/wk`] : [],
    filename: 'dose-chart.png',
    width: 360,
    height: 200,
  });

  if (isLoading) return <p className="p-6 text-center text-sm text-slate-400">Loading…</p>;
  if (error) return <p className="p-6 text-center text-sm text-red-600">Failed to load: {(error as Error).message}</p>;
  if (!gist || !series) return null;

  return (
    <Card>
      <div className="flex items-center gap-2 px-3 pt-2 flex-wrap">
        <RangePickerSelect days={range.days} onChange={range.setDays} />
        <label className="ml-auto flex items-center gap-1 text-[10.5px] font-semibold text-slate-600">
          <input type="checkbox" checked={showWeight} onChange={(e) => toggleShowWeight(e.target.checked)} />
          Show weight
        </label>
      </div>

      <Chart svgRef={svgRef} series={series} showWeight={showWeight} />

      <div className="flex items-center justify-center gap-3 px-3 py-2 text-[10px] text-slate-500 flex-wrap">
        <ChartLegendSwatch color="#4a90d9" label="Weekly dose" />
        {showWeight && <ChartLegendSwatch color="#34c759" label="Weight" />}
        {series.maintMarkers.length > 0 && <ChartLegendSwatch color="#8e8e93" label="Maintenance toggle" dashed />}
      </div>

      <ChartShareButton onShare={shareChart} onDownload={downloadChart} isSharing={isSharing} isDownloading={isDownloading} />
    </Card>
  );
}
