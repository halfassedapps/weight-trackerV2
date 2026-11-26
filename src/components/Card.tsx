// The "rounded-xl border border-slate-200 bg-white overflow-hidden" wrapper
// was independently repeated in eleven files — every chart and admin card in
// the app. Centralized here so the one visual language for "a card on this
// app" lives in one place. `title` covers the titled-header variant
// NutritionPage's three cards all needed (a thin bar + bold label above the
// content) without that file growing its own one-off copy of this wrapper.
export function Card({ title, className = '', children }: { title?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white overflow-hidden ${className}`}>
      {title && (
        <div className="px-3.5 pt-2.5 pb-1.5 border-b border-black/[.06]">
          <div className="text-[13px] font-bold text-slate-900">{title}</div>
        </div>
      )}
      {children}
    </div>
  );
}
