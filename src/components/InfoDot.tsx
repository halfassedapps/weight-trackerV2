// Ported from V1 (index.html:8575-8612) — a small "i" icon that opens a
// dark popover on click, closing on an outside click. Reused for BMI
// categories, the BP-averaging methodology note, and (in V1) the measured-
// TDEE explanation.
import { useEffect, useRef, useState } from 'react';

interface InfoDotProps {
  children: React.ReactNode;
  align?: 'left' | 'right';
}

export function InfoDot({ children, align = 'left' }: InfoDotProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-block ml-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="More info"
        className="w-[15px] h-[15px] rounded-full bg-slate-200 text-slate-400 text-[10px] font-bold leading-[15px] text-center italic"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        i
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className={`absolute top-5 z-10 w-[230px] bg-[#1c1c1e] text-white text-[11px] font-normal leading-[1.45] rounded-[10px] px-3 py-2.5 shadow-xl normal-case tracking-normal ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </div>
      )}
    </span>
  );
}
