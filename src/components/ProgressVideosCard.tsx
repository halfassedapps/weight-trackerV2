// Ported from V1's VideoPlayerModal/VideoThumb/ProgressVideosGrid
// (index.html:7131-7240).
import { useState } from 'react';
import { Card } from './Card';
import { useBodyScans, type BodyScanVideo } from '../hooks/useBodyScans';

const THUMB_W = 176;

function fmtShort(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function thumbOnLoaded(e: React.SyntheticEvent<HTMLVideoElement>) {
  const v = e.currentTarget;
  try {
    v.currentTime = Math.min(1, (v.duration || 2) / 2);
  } catch {
    /* some browsers refuse a seek before enough data has loaded — thumbnail just stays on frame 0 */
  }
}

function thumbOnSeeked(e: React.SyntheticEvent<HTMLVideoElement>) {
  const v = e.currentTarget;
  const p = v.play();
  if (p && p.then) p.then(() => v.pause()).catch(() => {});
}

function VideoThumb({ video, onPlayVideo, badge }: { video: BodyScanVideo; onPlayVideo: (v: BodyScanVideo) => void; badge?: string }) {
  return (
    <div
      onClick={() => onPlayVideo(video)}
      className="cursor-pointer rounded-xl overflow-hidden relative bg-black shrink-0"
      style={{ width: THUMB_W, aspectRatio: '3 / 4' }}
    >
      <video
        muted
        playsInline
        preload="auto"
        src={video.url}
        onLoadedMetadata={thumbOnLoaded}
        onSeeked={thumbOnSeeked}
        className="w-full h-full object-cover pointer-events-none"
      />
      <div
        className="absolute left-0 right-0 bottom-0 px-2 pb-2 pt-2.5 flex items-end"
        style={{ height: '30%', background: 'linear-gradient(to top, rgba(0,0,0,.95) 65%, transparent)' }}
      >
        <div className="text-white text-[11px] font-bold">
          {fmtShort(video.startDate)} – {fmtShort(video.endDate)}
        </div>
      </div>
      {badge && (
        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[8.5px] font-bold uppercase tracking-wide">
          {badge}
        </div>
      )}
      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center">
        <span className="text-white text-[9px]">▶</span>
      </div>
    </div>
  );
}

function VideoPlayerModal({ video, onClose }: { video: BodyScanVideo; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/[.72] z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-black rounded-2xl overflow-hidden w-full max-w-[400px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#1c1c1e]">
          <div className="text-[13px] font-semibold text-white">
            {video.label || 'Body Scan'} · {fmtShort(video.startDate)} – {fmtShort(video.endDate)}
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 text-xl leading-none px-1">
            ✕
          </button>
        </div>
        {/* ZOZO videos are portrait (540x960) — constrain by height, not width */}
        <video src={video.url} controls autoPlay playsInline className="block mx-auto w-auto h-auto max-w-full" style={{ maxHeight: '75vh' }} />
      </div>
    </div>
  );
}

export function ProgressVideosCard() {
  const { data: videos, isLoading } = useBodyScans();
  const [playing, setPlaying] = useState<BodyScanVideo | null>(null);

  if (isLoading || !videos || videos.length === 0) return null;

  const minStart = videos.reduce((min, v) => (v.startDate < min ? v.startDate : min), videos[0].startDate);
  const maxEnd = videos.reduce((max, v) => (v.endDate > max ? v.endDate : max), videos[0].endDate);
  const fullTerm = videos.find((v) => v.startDate === minStart && v.endDate === maxEnd);
  const segments = videos.filter((v) => v !== fullTerm).sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <Card title="Progress Videos">
      <div className="p-3 flex flex-wrap gap-2.5">
        {fullTerm && <VideoThumb video={fullTerm} onPlayVideo={setPlaying} badge="Full Term" />}
        {segments.map((v) => (
          <VideoThumb key={v.startDate} video={v} onPlayVideo={setPlaying} />
        ))}
      </div>
      {playing && <VideoPlayerModal video={playing} onClose={() => setPlaying(null)} />}
    </Card>
  );
}
