// Was byte-for-byte identical in WeightChart, BpChart, DoseChart, and
// PkChart (four copies) — the button half of useChartPngExport.
//
// Download and Share are separate, explicit buttons rather than one button
// that tries to share and falls back to download — the OS share sheet a
// successful navigator.share() call opens doesn't reliably offer a way to
// actually save the file anywhere (e.g. macOS Safari's sheet lists AirDrop/
// Mail/Messages/Notes/… but no "Save Image"/"Add to Photos"), so anyone who
// just wants the file needs a real, independent download path. Share is
// only shown where the Web Share API for files actually exists — on a
// browser without it, shareChart's own fallback already behaves exactly
// like downloadChart, so a second identical-looking button would just be
// confusing.
export interface ChartShareButtonProps {
  onShare: () => void;
  onDownload: () => void;
  isSharing: boolean;
  isDownloading: boolean;
}

const canShareFiles = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

export function ChartShareButton({ onShare, onDownload, isSharing, isDownloading }: ChartShareButtonProps) {
  return (
    <div className="flex items-center justify-center gap-2 pb-3">
      <button
        type="button"
        onClick={onDownload}
        disabled={isDownloading}
        className="inline-flex items-center leading-none rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-600 disabled:opacity-60"
      >
        {isDownloading ? 'Downloading…' : 'Download'}
      </button>
      {canShareFiles && (
        <button
          type="button"
          onClick={onShare}
          disabled={isSharing}
          className="inline-flex items-center leading-none rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-600 disabled:opacity-60"
        >
          {isSharing ? 'Sharing…' : 'Share'}
        </button>
      )}
    </div>
  );
}
