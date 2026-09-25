'use client';
import { useState } from 'react';
import { Sparkles, ArrowUpRight, LoaderCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Goal } from '@/lib/model';
const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const fullDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function GoalForm({
  goal,
  userId,
  onSaved,
}: {
  goal?: Goal;
  userId: string;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: goal?.title || '',
    category: goal?.category || 'personal',
    reason: goal?.reason || '',
    milestone: goal?.milestone || '',
    action: goal?.action || '',
    small_action: goal?.small_action || '',
    cue: goal?.cue || '',
    days: goal?.days || [1, 2, 3, 4, 5],
    unit: goal?.unit || 'minutes',
    target: goal?.target || 20,
    shared: goal?.shared || false,
  });
  const [prompt, setPrompt] = useState('');
  const [planning, setPlanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const update = (key: string, value: unknown) => setForm((old) => ({ ...old, [key]: value }));
  async function plan() {
    setPlanning(true);
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
      setForm((old) => ({ ...old, ...result.plan, days: [...new Set<number>(result.plan.days)] }));
      toast.success('A starting point, ready for your edits.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Planning failed');
    } finally {
      setPlanning(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.days.length) {
      toast.error('Choose at least one day.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        milestone: form.milestone.trim(),
        action: form.action.trim(),
        small_action: form.small_action.trim(),
        user_id: userId,
      };
      const { error } = goal
        ? await supabase.from('goals').update(payload).eq('id', goal.id)
        : await supabase.from('goals').insert(payload);
      if (error) throw error;
      await onSaved();
      toast.success(goal ? 'Your plan is updated.' : 'Your next chapter starts here.');
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : (e as { message?: string }).message || 'Could not save your goal',
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-stack">
      {!goal && (
        <section className="ai-box">
          <div className="row">
            <Sparkles size={18} />
            <strong>A little help getting started</strong>
          </div>
          <label className="sr-only" htmlFor="ai-goal">
            Describe your goal for AI
          </label>
          <textarea
            id="ai-goal"
            maxLength={1000}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="I want to learn enough JavaScript to build my first project…"
          />
          <button
            type="button"
            className="text-button"
            disabled={planning || prompt.trim().length < 5}
            onClick={plan}
          >
            {planning ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}{' '}
            {planning ? 'Building a starting point…' : 'Help me break it down'}
          </button>
          <small>Only this description goes to the AI planner. Review its suggestions below.</small>
        </section>
      )}
      <label>
        Goal name
        <input
          required
          maxLength={100}
          placeholder="Build a stronger body"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
        />
      </label>
      <label>
        Focus
        <select value={form.category} onChange={(e) => update('category', e.target.value)}>
          <option value="health">Health & movement</option>
          <option value="career">Career & learning</option>
          <option value="personal">Personal growth</option>
        </select>
      </label>
      <label>
        Why this matters to you <span className="muted">optional</span>
        <input
          maxLength={500}
          placeholder="I want more energy for the things I love"
          value={form.reason}
          onChange={(e) => update('reason', e.target.value)}
        />
      </label>
      <label>
        Your first milestone
        <input
          required
          maxLength={200}
          placeholder="Complete 12 strength sessions"
          value={form.milestone}
          onChange={(e) => update('milestone', e.target.value)}
        />
      </label>
      <div className="form-rule" />
      <label>
        Your regular quest <span className="pill">20 XP</span>
        <input
          required
          maxLength={200}
          placeholder="Move for 20 minutes"
          value={form.action}
          onChange={(e) => update('action', e.target.value)}
        />
      </label>
      <div className="form-columns">
        <label>
          Daily amount
          <input
            type="number"
            min="0.01"
            max="1000000"
            step="any"
            required
            value={form.target}
            onChange={(e) => update('target', Number(e.target.value))}
          />
        </label>
        <label>
          Unit
          <input
            required
            maxLength={30}
            value={form.unit}
            onChange={(e) => update('unit', e.target.value)}
            placeholder="minutes"
          />
        </label>
      </div>
      <label>
        Your smaller version <span className="pill">10 XP</span>
        <input
          required
          maxLength={200}
          placeholder="A five-minute walk around the block"
          value={form.small_action}
          onChange={(e) => update('small_action', e.target.value)}
        />
      </label>
      <label>
        Make it part of a routine
        <input
          maxLength={200}
          placeholder="After my morning coffee"
          value={form.cue}
          onChange={(e) => update('cue', e.target.value)}
        />
      </label>
      <fieldset>
        <legend>Quest days</legend>
        <div className="day-picker">
          {weekdays.map((day, i) => (
            <button
              key={i}
              type="button"
              aria-label={fullDays[i]}
              aria-pressed={form.days.includes(i)}
              onClick={() =>
                update(
                  'days',
                  form.days.includes(i) ? form.days.filter((d) => d !== i) : [...form.days, i],
                )
              }
            >
              {day}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="setting-row">
        <div>
          <strong>Share with your partner</strong>
          <p>Progress is visible. Notes stay private unless you share them.</p>
        </div>
        <Switch
          aria-label="Share this goal with partner"
          checked={form.shared}
          onCheckedChange={(v) => update('shared', v)}
        />
      </div>
      <button className="button primary" disabled={saving || planning} type="submit">
        {saving ? 'Saving…' : goal ? 'Save changes' : 'Create my goal'}
        <ArrowUpRight size={18} />
      </button>
    </form>
  );
}
