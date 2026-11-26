// Ported from V1's CSV import flow (index.html:9615-9638 applyResult,
// 9742-9780 onInput) — picks an Apple Health CSV export (e.g. from the
// HealthFit app), parses it, merges new rows into the live Gist by
// date/ms (see lib/domain/csv.ts's merge helpers), and writes the result in
// one shot. Not committed to the UI until the Gist write is confirmed,
// same as V1 — a parse that succeeds but fails to sync shouldn't leave this
// device looking "done" while everywhere else is out of step.
//
// Scope note: V1 also supports watching a local export folder (File System
// Access API) and auto-importing on a timer/poll, plus re-importing its own
// JSON backup format. Both are deliberately deferred here — this is a
// manual "pick a file" import only, which is the actual CSV-export path
// every device uses regardless.
import { useRef, useState } from 'react';
import { Card } from './Card';
import { useGistWrite } from '../hooks/useGistWrite';
import { mergeBpByMs, mergeCaloriesByDate, mergeEntriesByDate, processCSVText } from '../lib/domain/csv';

export function CsvImportCard() {
  const gistWrite = useGistWrite();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'importing' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const onFile = async (file: File) => {
    setStatus('importing');
    setMessage('');
    try {
      const text = await file.text();
      const result = processCSVText(text);
      await gistWrite.mutateAsync((current) => ({
        ...current,
        entries: mergeEntriesByDate(current.entries, result.weightEntries),
        calories: result.calorieData.length ? mergeCaloriesByDate(current.calories, result.calorieData) : current.calories,
        bloodPressure: result.bpData.length ? mergeBpByMs(current.bloodPressure, result.bpData) : current.bloodPressure,
        meta: result.meta,
      }));
      setStatus('done');
      const parts = [`${result.weightEntries.length} weight entr${result.weightEntries.length === 1 ? 'y' : 'ies'}`];
      if (result.calorieData.length) parts.push(`${result.calorieData.length} calorie day${result.calorieData.length === 1 ? '' : 's'}`);
      if (result.bpData.length) parts.push(`${result.bpData.length} BP reading${result.bpData.length === 1 ? '' : 's'}`);
      setMessage(`Imported ${parts.join(', ')}.`);
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Import failed — parsed fine but failed to sync to the Gist. Try again.');
    }
  };

  return (
    <Card className="px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[9px] uppercase tracking-wide text-slate-400">Import</div>
          <div className="text-[13px] font-semibold text-slate-900">Apple Health CSV export</div>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={status === 'importing'}
          className="text-[11px] font-semibold text-white bg-blue-600 rounded-full px-3 py-1.5 disabled:opacity-60 shrink-0"
        >
          {status === 'importing' ? 'Importing…' : 'Choose File'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) onFile(file);
          }}
        />
      </div>
      {message && <div className={`mt-2 text-[11px] ${status === 'error' ? 'text-red-500' : 'text-green-600'}`}>{message}</div>}
    </Card>
  );
}
