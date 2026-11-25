import { useState, type RefObject } from 'react';

export interface ChartPngExportOptions {
  title: string;
  subtitleLines?: string[];
  filename: string;
  /** Logical SVG width/height (the viewBox size), not its on-screen pixel size. */
  width: number;
  height: number;
  scale?: number;
}

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif";
const HEADER_H = 54;

/**
 * Replaces V1's 5x-duplicated `shareChart()` (BpChart, RidesChart, PkChart,
 * WeightChart, DoseChart each reimplemented the same canvas-rasterize-the-
 * SVG-and-draw-a-header routine independently). One implementation: clone
 * the SVG, rasterize it onto a canvas below a drawn title/subtitle header,
 * then hand the PNG to the Web Share API (falling back to a download link
 * when unavailable, e.g. desktop Safari/Firefox).
 */
export function useChartPngExport(svgRef: RefObject<SVGSVGElement | null>, opts: ChartPngExportOptions) {
  const [isSharing, setIsSharing] = useState(false);
  const { title, subtitleLines = [], filename, width, height, scale = 3 } = opts;

  const shareChart = async () => {
    if (isSharing || !svgRef.current) return;
    setIsSharing(true);
    try {
      const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
      svgClone.setAttribute('width', String(width * scale));
      svgClone.setAttribute('height', String(height * scale));
      const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      styleEl.textContent = `text { font-family: ${FONT}; }`;
      svgClone.insertBefore(styleEl, svgClone.firstChild);
      const svgString = new XMLSerializer().serializeToString(svgClone);
      const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to rasterize chart SVG'));
        img.src = svgUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = (height + HEADER_H) * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.fillStyle = '#1c1c1e';
      ctx.font = `700 13px ${FONT}`;
      ctx.fillText(title, 14, 18);
      ctx.fillStyle = '#4a90d9';
      ctx.font = `600 10px ${FONT}`;
      subtitleLines.forEach((line, i) => ctx.fillText(line, 14, 32 + i * 12));
      ctx.drawImage(img, 0, HEADER_H, width, height);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Failed to encode PNG');
      const file = new File([blob], filename, { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text: subtitleLines.join(' · ') });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        console.warn('[useChartPngExport] share failed:', err);
      }
    } finally {
      setIsSharing(false);
    }
  };

  return { shareChart, isSharing };
}
