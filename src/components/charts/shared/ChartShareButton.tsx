// Was byte-for-byte identical in WeightChart, BpChart, DoseChart, and
// PkChart (four copies) — the button half of useChartPngExport.
export interface ChartShareButtonProps {
  onClick: () => void;
  isSharing: boolean;
}

export function ChartShareButton({ onClick, isSharing }: ChartShareButtonProps) {
  return (
    <div className="flex justify-center pb-3">
      <button
        type="button"
        onClick={onClick}
        disabled={isSharing}
        className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-600 disabled:opacity-60"
      >
        {isSharing ? 'Sharing…' : 'Share'}
      </button>
    </div>
  );
}
