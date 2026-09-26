'use client';
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import type { Goal, Entry, Period } from '@/lib/model';
export function CheckinForm({
  goal,
  entry,
  note,
  day,
  period,
  onSaved,
}: {
  goal: Goal;
  entry?: Entry;
  note: string;
  day: string;
  period?: Period | null;
  onSaved: () => Promise<void>;
}) {
  const quantity = period?.measure === 'quantity';
  const legacy = Boolean(entry && !entry.period_id);
  const [status, setStatus] = useState<Entry['status']>(entry?.status || 'full');
  const [total, setTotal] = useState(entry?.quantity ?? 0);
  const [body, setBody] = useState(note);
  const [share, setShare] = useState(Boolean(entry?.shared_note));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { error } = await supabase.rpc('log_quest', {
        gid: goal.id,
        log_day: day,
        result: quantity ? (total > 0 ? 'full' : 'skipped') : status,
        amount: quantity || legacy ? total : status === 'full' ? 1 : 0,
        note: body,
        share_note: share,
      });
      if (error) throw error;
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form-stack" onSubmit={save}>
      {quantity ? (
        <label>
          Today’s total ({period.unit})
          <input
            type="number"
            step="any"
            min="0"
            max="1000000"
            required
            value={total}
            onChange={(e) => setTotal(Number(e.target.value))}
          />
          <small>Replaces this day’s total. Log 5 if you completed 2 earlier and 3 more.</small>
        </label>
      ) : (
        <div className="completion-options">
          {(
            [
              { key: 'full', name: 'Full action', copy: goal.action, xp: 20 },
              { key: 'small', name: 'Smaller action', copy: goal.small_action, xp: 10 },
              { key: 'skipped', name: 'Skip', copy: 'No XP lost.', xp: 0 },
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              className="completion-option"
              aria-pressed={status === o.key}
              onClick={() => setStatus(o.key)}
            >
              <span>
                <strong>{o.name}</strong>
                <small>{o.copy}</small>
              </span>
              <b>{o.xp} XP</b>
            </button>
          ))}
        </div>
      )}
      {legacy && (
        <label>
          Recorded amount ({goal.unit})
          <input
            type="number"
            min="0"
            max="1000000"
            step="any"
            value={total}
            onChange={(e) => setTotal(Number(e.target.value))}
          />
        </label>
      )}
      <label>
        Note <span className="muted">Optional</span>
        <textarea
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="How did it go?"
        />
      </label>
      {goal.shared && (
        <div className="setting-row">
          <strong>Share note</strong>
          <Switch aria-label="Share note with partner" checked={share} onCheckedChange={setShare} />
        </div>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="button primary" disabled={busy}>
        {busy ? 'Saving…' : 'Save progress'}
      </button>
    </form>
  );
}
