// Ported from V1's manual injection-logging form (index.html:9789-9812
// addInjection, 10525-10579 JSX) plus buildInjEntry (index.html:239-246).
// Closes a real gap: before this, V2 had no way to log a new injection at
// all — CSV import only ever covers weight/calorie/BP data, never doses.
import { useState } from 'react';
import { Card } from './Card';
import { useAuth } from '../hooks/useAuth';
import { useGistWrite } from '../hooks/useGistWrite';
import { msToLocalDate } from '../lib/domain/csv';
import type { Injection } from '../lib/gist/types';

const INJECTION_SITES = [
  'Abdomen – Left, Upper',
  'Abdomen – Left, Middle',
  'Abdomen – Left, Lower',
  'Abdomen – Right, Upper',
  'Abdomen – Right, Middle',
  'Abdomen – Right, Lower',
  'Left Thigh',
  'Right Thigh',
  'Left Upper Arm',
  'Right Upper Arm',
];

function buildInjEntry(date: string, doseMg: number, site: string, nausea: string, hunger: string, foodNoise: string): Injection {
  const e: Injection = { date, doseMg };
  if (site) e.site = site;
  if (nausea !== '') e.nausea = Number(nausea);
  if (hunger !== '') e.hunger = Number(hunger);
  if (foodNoise !== '') e.foodNoise = Number(foodNoise);
  return e;
}

export function AddInjectionCard() {
  const { isAdmin } = useAuth();
  const gistWrite = useGistWrite();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => msToLocalDate(Date.now()));
  const [doseMg, setDoseMg] = useState('');
  const [site, setSite] = useState('');
  const [nausea, setNausea] = useState('');
  const [hunger, setHunger] = useState('');
  const [foodNoise, setFoodNoise] = useState('');
  const [error, setError] = useState('');

  if (!isAdmin) return null;

  const reset = () => {
    setDoseMg('');
    setSite('');
    setNausea('');
    setHunger('');
    setFoodNoise('');
    setError('');
  };

  const addInjection = async () => {
    const dose = parseFloat(doseMg);
    if (!date || isNaN(dose) || dose <= 0) return;
    const entry = buildInjEntry(date, dose, site, nausea, hunger, foodNoise);
    setError('');
    try {
      await gistWrite.mutateAsync((current) => ({
        ...current,
        // Last-write-wins on the same date, same as every other dated-entry
        // merge in this app (weight entries, calorie targets, ...).
        injections: [...current.injections.filter((i) => i.date !== date), entry].sort((a, b) => b.date.localeCompare(a.date)),
      }));
      setOpen(false);
      reset();
    } catch {
      setError("Couldn't save — check your connection and try again.");
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between px-3.5 py-3">
        <div>
          <div className="text-[9px] uppercase tracking-wide text-slate-400">Injections</div>
          <div className="text-[13px] font-semibold text-slate-900">Log a new dose</div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`text-[13px] font-semibold px-3 py-1.5 rounded-lg ${open ? 'bg-slate-100 text-slate-900' : 'bg-blue-600 text-white'}`}
        >
          {open ? 'Cancel' : '+ Log injection'}
        </button>
      </div>

      {open && (
        <div className="px-3.5 pb-3.5 flex flex-col gap-2.5 border-t border-black/[.06] pt-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Date</div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-base px-2.5 py-2 rounded-[10px] border border-slate-300"
              />
            </div>
            <div className="w-[90px]">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Dose (mg)</div>
              <input
                type="number"
                step={0.25}
                min={0.25}
                placeholder="2.5"
                value={doseMg}
                onChange={(e) => setDoseMg(e.target.value)}
                className="w-full text-base px-2.5 py-2 rounded-[10px] border border-slate-300"
              />
            </div>
            <button
              type="button"
              onClick={addInjection}
              disabled={!date || !doseMg || gistWrite.isPending}
              className="text-base font-semibold px-4 py-2 rounded-[10px] bg-green-600 text-white disabled:bg-slate-200 disabled:text-slate-400"
            >
              {gistWrite.isPending ? 'Saving…' : 'Add'}
            </button>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Site (optional)</div>
            <select value={site} onChange={(e) => setSite(e.target.value)} className="w-full text-base px-2.5 py-2 rounded-[10px] border border-slate-300">
              <option value="">— Not specified —</option>
              {INJECTION_SITES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="text-[11px] text-slate-400 -mt-0.5">Symptoms since last injection</div>
            <SurveySlider label="Nausea" value={nausea} onChange={setNausea} />
            <SurveySlider label="Hunger" value={hunger} onChange={setHunger} />
            <SurveySlider label="Food noise" value={foodNoise} onChange={setFoodNoise} />
          </div>

          {error && <div className="text-[11px] text-red-500">{error}</div>}
        </div>
      )}
    </Card>
  );
}

function SurveySlider({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
        <span className="text-xs font-bold text-blue-600 tabular-nums">{value === '' ? '—' : value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value === '' ? 0 : value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full accent-blue-600"
      />
    </div>
  );
}
