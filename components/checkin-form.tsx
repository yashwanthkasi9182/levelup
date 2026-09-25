'use client';
import { useState } from 'react';
import { Check, Feather, Minus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import type { Goal, Entry } from '@/lib/model';
import { toast } from 'sonner';
export function CheckinForm({
  goal,
  entry,
  note,
  day,
  onSaved,
}: {
  goal: Goal;
  entry?: Entry;
  note: string;
  day: string;
  onSaved: (xp: number) => Promise<void>;
}) {
  const [status, setStatus] = useState<Entry['status']>(entry?.status || 'full');
  const [body, setBody] = useState(note);
  const [amount, setAmount] = useState(entry?.quantity ?? goal.target);
  const [shared, setShared] = useState(Boolean(entry?.shared_note));
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.rpc('log_quest', {
        gid: goal.id,
        log_day: day,
        result: status,
        amount: status === 'skipped' ? 0 : amount,
        note: body,
        share_note: shared,
      });
      if (error) throw error;
      await onSaved((status === 'full' ? 20 : status === 'small' ? 10 : 0) - (entry?.xp || 0));
    } catch (e) {
      toast.error((e as Error).message || 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="form-stack">
      <div className="completion-options">
        {(
          [
            { key: 'full', label: 'Full quest', text: goal.action, icon: Check, xp: 20 },
            { key: 'small', label: 'Smaller step', text: goal.small_action, icon: Feather, xp: 10 },
            {
              key: 'skipped',
              label: 'Not today',
              text: 'A missed day doesn’t erase your progress.',
              icon: Minus,
              xp: 0,
            },
          ] as const
        ).map((o) => (
          <button
            type="button"
            key={o.key}
            aria-pressed={status === o.key}
            onClick={() => {
              setStatus(o.key);
              setAmount(
                o.key === 'full' ? goal.target : entry?.status === o.key ? entry.quantity : 0,
              );
            }}
            className="completion-option"
          >
            <o.icon size={20} />
            <span>
              <strong>{o.label}</strong>
              <small>{o.text}</small>
            </span>
            <b>{o.xp} XP</b>
          </button>
        ))}
      </div>
      {status !== 'skipped' && (
        <label>
          Amount completed ({goal.unit})
          <input
            type="number"
            min="0"
            max="1000000"
            step="any"
            required
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </label>
      )}
      <label>
        A note to your future self <span className="muted">optional</span>
        <textarea
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What went well? What got in the way?"
          rows={3}
        />
      </label>
      {goal.shared && (
        <div className="setting-row">
          <div>
            <strong>Share this note</strong>
            <p>Your partner can already see this goal’s progress.</p>
          </div>
          <Switch
            aria-label="Share this note with partner"
            checked={shared}
            onCheckedChange={setShared}
          />
        </div>
      )}
      <button className="button primary" disabled={busy}>
        {busy ? 'Saving your progress…' : entry ? 'Update check-in' : 'Save my progress'}
        <Check size={18} />
      </button>
    </form>
  );
}
