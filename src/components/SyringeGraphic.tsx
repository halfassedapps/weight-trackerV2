// Ported from V1 (index.html:8034-8155) — a filled-syringe-barrel SVG
// showing where to draw up to for a given dose, vial concentration, and
// syringe size. Pure rendering, no state of its own.
interface SyringeGraphicProps {
  doseMg: number;
  concentration?: number;
  color?: string;
  maxUnits?: number;
}

export function SyringeGraphic({ doseMg, concentration = 12.5, color = '#4a90d9', maxUnits = 100 }: SyringeGraphicProps) {
  const units = doseMg > 0 ? Math.round(((doseMg / concentration) * 100 * 10)) / 10 : 0;
  const ml = doseMg > 0 ? (doseMg / concentration).toFixed(2) : '—';
  const syringeMax = maxUnits;
  const pct = Math.min(units / syringeMax, 1);
  const uid = `syr${Math.round(doseMg * 1000)}_${Math.round(concentration * 100)}`;

  const VW = 360;
  const VH = 108;
  const bx = 80;
  const by = 42;
  const bw = 210;
  const bh = 28;
  const ncy = by + bh / 2;
  const fillW = pct * bw;
  const gaskL = Math.max(bx + 2, bx + fillW);
  const gaskR = gaskL + 10;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-auto block">
      <defs>
        <clipPath id={`${uid}c`}>
          <rect x={bx} y={by} width={bw} height={bh} />
        </clipPath>
        <linearGradient id={`${uid}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.14" />
          <stop offset="50%" stopColor={color} stopOpacity="0.34" />
          <stop offset="100%" stopColor={color} stopOpacity="0.22" />
        </linearGradient>
      </defs>

      <line x1={12} y1={ncy - 1.4} x2={70} y2={ncy - 1.4} stroke="#b8b8c8" strokeWidth="1.8" strokeLinecap="square" />
      <line x1={28} y1={ncy + 1.4} x2={70} y2={ncy + 1.4} stroke="#a8a8b8" strokeWidth="1.2" strokeLinecap="square" />
      <line x1={12} y1={ncy - 1.4} x2={28} y2={ncy + 1.4} stroke="#9898a8" strokeWidth="0.9" />

      <rect x={62} y={ncy - 9} width={13} height={18} rx={2} fill="#c4c4d6" stroke="#acacc0" strokeWidth="0.7" />
      <line x1={66} y1={ncy - 9} x2={66} y2={ncy + 9} stroke="rgba(255,255,255,.5)" strokeWidth="1" />
      <line x1={70} y1={ncy - 9} x2={70} y2={ncy + 9} stroke="rgba(255,255,255,.35)" strokeWidth="1" />

      <rect x={bx - 5} y={by - 5} width={7} height={bh + 10} rx={3} fill="#cacada" stroke="#b8b8ca" strokeWidth="0.5" />

      <rect x={bx} y={by} width={bw} height={bh} fill="#eeeefb" />

      {fillW > 0 && <rect x={bx} y={by} width={fillW} height={bh} fill={`url(#${uid}f)`} clipPath={`url(#${uid}c)`} />}

      <rect x={bx} y={by} width={bw} height={4} fill="rgba(255,255,255,.58)" clipPath={`url(#${uid}c)`} />

      {Array.from({ length: syringeMax / 5 + 1 }, (_, i) => i * 5).map((u) => {
        const tx = bx + (u / syringeMax) * bw;
        const big = u % (syringeMax / 3 < 10 ? 10 : 20) === 0;
        const med = u % 10 === 0;
        const h = big ? 12 : med ? 8 : 5;
        return (
          <line
            key={u}
            x1={tx}
            y1={by}
            x2={tx}
            y2={by + h}
            stroke={u / syringeMax < pct ? 'rgba(255,255,255,.78)' : '#9898b2'}
            strokeWidth={big ? 1.4 : med ? 1.0 : 0.65}
          />
        );
      })}

      {Array.from({ length: syringeMax / 10 }, (_, i) => (i + 1) * 10).map((u) => (
        <text key={u} x={bx + (u / syringeMax) * bw} y={by - 4} textAnchor="middle" fontSize={7.5} fill="#9090a8">
          {u}
        </text>
      ))}

      <rect x={bx} y={by} width={bw} height={bh} fill="none" stroke="#b0b0c6" strokeWidth="1" />

      <rect x={bx + bw - 2} y={by - 5} width={7} height={bh + 10} rx={3} fill="#cacada" stroke="#b8b8ca" strokeWidth="0.5" />

      <rect x={gaskL} y={by + 1} width={10} height={bh - 2} rx={2.5} fill="#262636" />
      <rect x={gaskL} y={by + 1} width={3.5} height={bh - 2} rx={1.5} fill="#40404e" />
      <line x1={gaskL + 1.8} y1={by + 5} x2={gaskL + 1.8} y2={by + bh - 5} stroke="rgba(255,255,255,.18)" strokeWidth="1.5" strokeLinecap="round" />

      <rect x={gaskR + 1} y={ncy - 2.5} width={Math.max(0, bx + bw + 12 - (gaskR + 1))} height={5} rx={2.5} fill="#b8b8cc" />

      <rect x={bx + bw + 14} y={by - 5} width={5} height={bh + 10} rx={2.5} fill="#9090a6" />

      {doseMg > 0 &&
        (() => {
          const cx = Math.min(Math.max(bx + fillW / 2, bx + 20), bx + bw - 20);
          return (
            <>
              <text x={cx} y={by + bh + 18} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={color}>
                {units} units
              </text>
              <text x={cx} y={by + bh + 30} textAnchor="middle" fontSize={8.5} fill={color} opacity={0.7}>
                {ml} mL
              </text>
            </>
          );
        })()}
    </svg>
  );
}
