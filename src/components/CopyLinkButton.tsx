// A "Copy link" convenience next to WeightChart's Share button — admin-only,
// copies the absolute /share URL (the same stripped-down, tirzepatide-free
// view the header's "Share progress →" link opens) to the clipboard so it's
// one tap to paste into a text/chat without opening the page first.
// Ported styling from V1's CopyLinkButton (index.html:8654-8689) — flex +
// an inline SVG icon, not an emoji glyph, which is what kept it from ever
// misaligning against the neighboring Share button the way an emoji can
// (emoji glyphs have no explicit box size, so they can render taller than
// the surrounding text and throw off the row).
import { useState } from 'react';

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    const url = `${location.origin}${import.meta.env.BASE_URL}share`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this link:', url);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={copyLink}
      className="inline-flex items-center leading-none gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ color: copied ? '#16a34a' : '#2563eb', background: copied ? '#f0fdf4' : '#eff6ff' }}
    >
      {copied ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      )}
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  );
}
