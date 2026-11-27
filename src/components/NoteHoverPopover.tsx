// A hover (and tap-to-toggle, for touch) popover that shows a full note's
// text. Portaled to document.body and positioned with `fixed` coordinates
// from the trigger's own bounding box, so it isn't clipped by an ancestor
// table's `overflow-y-auto` (e.g. BpChart's Table).
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface NoteHoverPopoverProps {
  note: string;
  children: React.ReactNode;
  className?: string;
}

const POPOVER_WIDTH = 220;

export function NoteHoverPopover({ note, children, className }: NoteHoverPopoverProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const show = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.bottom + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8)) });
    setOpen(true);
  };
  const hide = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    const onDocClick = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('mousedown', onDocClick);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('mousedown', onDocClick);
    };
  }, [open]);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={(e) => {
          e.stopPropagation();
          if (open) hide();
          else show();
        }}
        className={`cursor-help ${className ?? ''}`}
      >
        {children}
      </span>
      {open &&
        coords &&
        createPortal(
          <div
            style={{ position: 'fixed', top: coords.top, left: coords.left, width: POPOVER_WIDTH, zIndex: 1000 }}
            className="bg-[#1c1c1e] text-white text-[11px] leading-[1.45] rounded-[10px] px-3 py-2.5 shadow-xl"
          >
            {note}
          </div>,
          document.body,
        )}
    </>
  );
}
