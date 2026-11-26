// Ported from V1's injection-log table (index.html:10589-10702) — view,
// edit, and delete past injections. AddInjectionCard only ever covered
// logging a *new* dose; this closes the remaining gap, where V2 had no way
// to see or correct a past entry at all.
import { useState } from 'react';
import { Card } from './Card';
import { SurveySlider } from './SurveySlider';
import { useAuth } from '../hooks/useAuth';
import { useGistData } from '../hooks/useGistData';
import { useGistWrite } from '../hooks/useGistWrite';
import { maintToggleLabel } from '../lib/domain/maintenance';
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

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtShort(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function InjectionLogCard() {
  const { data: gist, isLoading, error } = useGistData();
  const { isAdmin } = useAuth();
  const gistWrite = useGistWrite();

  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editDose, setEditDose] = useState('');
  const [editSite, setEditSite] = useState('');
  const [editNausea, setEditNausea] = useState('');
  const [editHunger, setEditHunger] = useState('');
  const [editFoodNoise, setEditFoodNoise] = useState('');

  if (isLoading) return null;
  if (error) return null;
  if (!gist || gist.injections.length === 0) return null;

  const startEdit = (inj: Injection) => {
    setEditingDate(inj.date);
    setEditDate(inj.date);
    setEditDose(String(inj.doseMg));
    setEditSite(inj.site ?? '');
    setEditNausea(inj.nausea != null ? String(inj.nausea) : '');
    setEditHunger(inj.hunger != null ? String(inj.hunger) : '');
    setEditFoodNoise(inj.foodNoise != null ? String(inj.foodNoise) : '');
  };

  const cancelEdit = () => setEditingDate(null);

  const saveEdit = async (originalDate: string) => {
    const dose = parseFloat(editDose);
    if (!editDate || isNaN(dose) || dose <= 0) return;
    const entry: Injection = { date: editDate, doseMg: dose };
    if (editSite) entry.site = editSite;
    if (editNausea !== '') entry.nausea = Number(editNausea);
    if (editHunger !== '') entry.hunger = Number(editHunger);
    if (editFoodNoise !== '') entry.foodNoise = Number(editFoodNoise);
    await gistWrite.mutateAsync((current) => ({
      ...current,
      injections: [...current.injections.filter((i) => i.date !== originalDate && i.date !== editDate), entry].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    }));
    setEditingDate(null);
  };

  const deleteInjection = (date: string) => {
    gistWrite.mutate((current) => ({
      ...current,
      injections: current.injections.filter((i) => i.date !== date),
    }));
  };

  const sorted = [...gist.injections].sort((a, b) => b.date.localeCompare(a.date));
  const maintenanceHistory = gist.maintenanceHistory ?? [];

  return (
    <Card title="Injection Log">
      <div className="max-h-[440px] overflow-y-auto">
        {sorted.map((inj, i, arr) => {
          const prevMs = i > 0 ? new Date(`${arr[i - 1].date}T12:00:00`).getTime() : Infinity;
          const curMs = new Date(`${inj.date}T12:00:00`).getTime();
          const maintHere = maintenanceHistory
            .filter((h) => {
              const ms = new Date(`${h.date}T12:00:00`).getTime();
              return ms <= prevMs && ms > curMs;
            })
            .sort((a, b) => a.date.localeCompare(b.date));

          return (
            <div key={inj.date}>
              {maintHere.map((h) => (
                <div key={h.date + h.action} className="px-3.5 py-1 text-[10.5px] font-bold text-blue-600 bg-blue-50 border-b border-black/[.06]">
                  {maintToggleLabel(h.action)} · {fmtShort(h.date)}
                </div>
              ))}
              {editingDate === inj.date ? (
                <div className="px-3.5 py-2.5 flex flex-col gap-2 border-b border-black/[.06] bg-slate-50">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Date</div>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full text-[15px] px-2 py-1.5 rounded-[9px] border border-slate-300 bg-white"
                      />
                    </div>
                    <div className="w-20">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Dose (mg)</div>
                      <input
                        type="number"
                        step={0.25}
                        min={0.25}
                        value={editDose}
                        onChange={(e) => setEditDose(e.target.value)}
                        className="w-full text-[15px] px-2 py-1.5 rounded-[9px] border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                  <select
                    value={editSite}
                    onChange={(e) => setEditSite(e.target.value)}
                    className="w-full text-[15px] px-2 py-1.5 rounded-[9px] border border-slate-300 bg-white"
                  >
                    <option value="">— Not specified —</option>
                    {INJECTION_SITES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-col gap-2">
                    <div className="text-[11px] text-slate-400 -mt-0.5">Symptoms since last injection</div>
                    <SurveySlider label="Nausea" value={editNausea} onChange={setEditNausea} />
                    <SurveySlider label="Hunger" value={editHunger} onChange={setEditHunger} />
                    <SurveySlider label="Food noise" value={editFoodNoise} onChange={setEditFoodNoise} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(inj.date)}
                      disabled={!editDate || !editDose || gistWrite.isPending}
                      className="flex-1 text-[15px] font-semibold py-1.5 rounded-[9px] bg-green-600 text-white disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      {gistWrite.isPending ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={gistWrite.isPending}
                      className="flex-1 text-[15px] font-semibold py-1.5 rounded-[9px] bg-slate-100 text-slate-900"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center px-3.5 py-2.5 border-b border-black/[.06] last:border-b-0">
                  <div className="flex-1 text-[15px] font-semibold text-slate-900">
                    {fmtShort(inj.date)}
                    <span className="text-xs text-slate-400 ml-1.5">{WD[new Date(`${inj.date}T12:00:00`).getDay()]}</span>
                    {inj.site && <span className="text-xs text-slate-400 ml-1.5">· {inj.site}</span>}
                    {(inj.nausea != null || inj.hunger != null || inj.foodNoise != null) && (
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {inj.nausea != null && `N${inj.nausea} `}
                        {inj.hunger != null && `H${inj.hunger} `}
                        {inj.foodNoise != null && `F${inj.foodNoise}`}
                      </div>
                    )}
                  </div>
                  <div className="text-[15px] font-semibold text-blue-600 tabular-nums">{inj.doseMg} mg</div>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(inj)}
                        disabled={gistWrite.isPending}
                        className="ml-3 text-[13px] font-semibold text-blue-600 disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteInjection(inj.date)}
                        disabled={gistWrite.isPending}
                        className="ml-1 text-sm text-slate-300 px-0.5 disabled:opacity-50"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
