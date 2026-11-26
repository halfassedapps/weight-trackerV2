// A "Copy link" convenience next to WeightChart's Share button — admin-only,
// copies the absolute /share URL (the same stripped-down, tirzepatide-free
// view the header's "Share progress →" link opens) to the clipboard so it's
// one tap to paste into a text/chat without opening the page first.
import { useState } from 'react';

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    const url = `${location.origin}${import.meta.env.BASE_URL}share`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard permission denied — nothing to recover, the button just doesn't confirm */
    }
  };

  return (
    <button type="button" onClick={copyLink} className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-600">
      {copied ? 'Copied!' : '🔗 Copy link'}
    </button>
  );
}
