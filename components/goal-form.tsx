'use client';
import { useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Goal, Target } from '@/lib/model';
type Form = Target & {
  title: string;
  category: Goal['category'];
  reason: string;
  milestone: string;
  action: string;
  small_action: string;
  cue: string;
  shared: boolean;
};
export function GoalForm({ goal, onSaved }: { goal?: Goal; onSaved: () => Promise<void> }) {
  const config = goal?.pending || goal?.current_period;
  const savedId = useRef<string | null>(goal?.id || null);
  const [form, setForm] = useState<Form>({
    title: goal?.title || '',
    category: goal?.category || 'personal',
    reason: goal?.reason || '',
    milestone: goal?.milestone || '',
    action: goal?.action || '',
    small_action: goal?.small_action || '',
    cue: goal?.cue || '',
    shared: goal?.shared || false,
    measure: config?.measure || 'days',
    period: config?.period || 'week',
    target: config?.target || 5,
    unit: config?.unit || 'days',
  });
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState('');
  const update = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((old) => ({ ...old, [key]: value }));
  async function plan() {
    setPlanning(true);
    setError('');
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session?.access_token}`,
        },
        body: JSON.stringify({ goal: prompt }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setForm((old) => ({ ...old, ...result.plan }));
      toast.success('Plan ready. Review and save.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPlanning(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data: id, error } = await supabase.rpc('save_goal', {
        gid: savedId.current,
        payload: form,
      });
      if (error) throw error;
      savedId.current = id;
      await onSaved();
      toast.success(goal ? 'Goal updated' : 'Goal created');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="form-stack">
      {!goal && (
        <details className="optional-fields ai-details">
          <summary>
            <Sparkles size={16} />
            Plan with AI
          </summary>
          <label>
            Describe your goal
            <textarea
              maxLength={1000}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Solve 10 coding questions each month"
            />
          </label>
          <button
            type="button"
            className="text-button"
            disabled={planning || prompt.trim().length < 5}
            onClick={plan}
          >
            {planning ? 'Planning…' : 'Make a plan'}
          </button>
          <small>Only this description is sent to the planner.</small>
        </details>
      )}
      <label>
        Goal
        <input
          required
          maxLength={100}
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder="Gym"
        />
      </label>
      <div className="form-columns">
        <label>
          Measure
          <select
            value={form.measure}
            onChange={(e) => {
              const measure = e.target.value as Form['measure'];
              setForm((old) => ({
                ...old,
                measure,
                unit: measure === 'days' ? 'days' : 'questions',
                target:
                  measure === 'days'
                    ? Math.min(old.target, old.period === 'week' ? 7 : 31)
                    : old.target,
              }));
            }}
          >
            <option value="days">Active days</option>
            <option value="quantity">Total quantity</option>
          </select>
        </label>
        <label>
          Period
          <select
            value={form.period}
            onChange={(e) => {
              const period = e.target.value as Form['period'];
              setForm((old) => ({
                ...old,
                period,
                target:
                  old.measure === 'days'
                    ? Math.min(old.target, period === 'week' ? 7 : 31)
                    : old.target,
              }));
            }}
          >
            <option value="week">Per week</option>
            <option value="month">Per month</option>
          </select>
        </label>
      </div>
      <div className="form-columns">
        <label>
          Target
          <input
            required
            type="number"
            min={form.measure === 'days' ? 1 : 0.01}
            max={form.measure === 'days' ? (form.period === 'week' ? 7 : 31) : 1000000}
            step={form.measure === 'days' ? 1 : 'any'}
            value={form.target}
            onChange={(e) => update('target', Number(e.target.value))}
          />
        </label>
        {form.measure === 'quantity' ? (
          <label>
            Unit
            <input
              required
              maxLength={30}
              value={form.unit}
              onChange={(e) => update('unit', e.target.value)}
              placeholder="questions"
            />
          </label>
        ) : (
          <div className="target-preview">
            <b>{form.target} days</b>
            <span>Any days this {form.period}</span>
          </div>
        )}
      </div>
      {form.measure === 'days' && (
        <>
          <label>
            Full action
            <input
              required
              maxLength={200}
              value={form.action}
              onChange={(e) => update('action', e.target.value)}
              placeholder="Finish my gym workout"
            />
          </label>
          <label>
            Smaller action
            <input
              required
              maxLength={200}
              value={form.small_action}
              onChange={(e) => update('small_action', e.target.value)}
              placeholder="Five minutes of movement"
            />
            <small>10 XP. Full actions count toward your day target.</small>
          </label>
        </>
      )}
      <details className="optional-fields">
        <summary>Details</summary>
        <label>
          Focus
          <select
            value={form.category}
            onChange={(e) => update('category', e.target.value as Form['category'])}
          >
            <option value="health">Health</option>
            <option value="career">Career</option>
            <option value="personal">Personal</option>
          </select>
        </label>
        {(['reason', 'milestone', 'cue'] as const).map((key) => (
          <label key={key}>
            {key === 'reason'
              ? 'Why it matters'
              : key === 'milestone'
                ? 'Milestone'
                : 'Routine cue'}
            <input
              maxLength={key === 'reason' ? 500 : 200}
              value={form[key]}
              onChange={(e) => update(key, e.target.value)}
            />
          </label>
        ))}
      </details>
      <div className="setting-row">
        <strong>Share with partner</strong>
        <Switch
          aria-label="Share goal with partner"
          checked={form.shared}
          onCheckedChange={(v) => update('shared', v)}
        />
      </div>
      {goal && (
        <small>
          Target changes begin after the current period. Earlier progress stays unchanged.
        </small>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary" disabled={busy || planning}>
        {busy ? 'Saving…' : goal ? 'Save goal' : 'Create goal'}
      </button>
    </form>
  );
}
