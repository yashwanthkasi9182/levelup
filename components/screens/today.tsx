'use client';
import { MAX_ACTIVE_GOALS } from '@/lib/limits';
import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Insignia } from '../insignia';
import { GoalProgress, categoryIcons, Empty } from './shared';
import { dayKey, levelFor, type Dashboard, type Goal, type Profile } from '@/lib/model';
export function TodayScreen({
  data,
  profile,
  onLog,
  onCreate,
}: {
  data: Dashboard;
  profile: Profile;
  onLog: (goal: Goal, day: string) => void;
  onCreate: () => void;
}) {
  const today = dayKey(new Date(), profile.timezone);
  const [chosen, setChosen] = useState('');
  const day = chosen || today;
  const mine = data.goals.filter((g) => g.user_id === profile.id);
  const active = mine.filter((g) => !g.archived);
  const goals =
    day === today
      ? active
      : mine.filter(
          (g) =>
            data.periods.some(
              (p) =>
                p.goal_id === g.id &&
                p.effective_on <= day &&
                p.ends_on >= day &&
                (!p.run_ends_on || p.run_ends_on >= day),
            ) || data.entries.some((e) => e.goal_id === g.id && e.day === day),
        );
  const complete = goals.filter((g) => day === today && g.current_period?.achieved);
  const pending = goals.filter((g) => !complete.includes(g));
  const level = levelFor(data.total_xp);
  function card(goal: Goal) {
    const Icon = categoryIcons[goal.category];
    const entry = data.entries.find((e) => e.goal_id === goal.id && e.day === day);
    return (
      <article className={`quest-v2 ${goal.category}`} key={goal.id}>
        <div className="row spread">
          <div className="row">
            <span className="quest-icon">
              <Icon size={21} />
            </span>
            <div>
              <h3>{goal.title}</h3>
              <small>
                {goal.current_period?.measure === 'days' ? goal.action : goal.current_period?.unit}
              </small>
            </div>
          </div>
          <button className="button secondary log-button" onClick={() => onLog(goal, day)}>
            {entry ? 'Edit' : 'Log'}
          </button>
        </div>
        <GoalProgress goal={goal} />
        {entry && (
          <div className="entry-status">
            <Check size={13} />
            {entry.status === 'skipped'
              ? 'Skipped'
              : entry.status === 'small'
                ? 'Smaller step'
                : goal.current_period?.measure === 'quantity'
                  ? `${entry.quantity} logged`
                  : 'Full action'}{' '}
            · {entry.xp} XP
          </div>
        )}
      </article>
    );
  }
  return (
    <section className="screen">
      <div className="v2-heading">
        <div>
          <p className="eyebrow">
            {new Date().toLocaleDateString('en', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              timeZone: profile.timezone,
            })}
          </p>
          <h1>Today</h1>
        </div>
        <button
          className="icon-button outlined"
          aria-label="Create goal"
          disabled={active.length >= MAX_ACTIVE_GOALS}
          onClick={onCreate}
        >
          <Plus size={20} />
        </button>
      </div>
      <section className="player-strip">
        <span className="player-mark">
          <Insignia mark={profile.avatar} size={47} />
        </span>
        <div className="player-strip-main">
          <div className="row spread">
            <strong>{profile.name}</strong>
            <span>Level {level}</span>
          </div>
          <Progress value={data.total_xp % 100} aria-label="Level progress" />
          <div className="row spread">
            <small>{data.total_xp} XP</small>
            <small>{100 - (data.total_xp % 100)} to next level</small>
          </div>
        </div>
      </section>
      <div className="section-heading">
        <h2>Your quests</h2>
        <label className="compact-date">
          <span className="sr-only">Log date</span>
          <input type="date" max={today} value={day} onChange={(e) => setChosen(e.target.value)} />
        </label>
      </div>
      <div className="quest-list">{pending.map(card)}</div>
      {complete.length > 0 && (
        <details className="completed-group" open={pending.length === 0}>
          <summary>
            Completed <span>{complete.length}</span>
          </summary>
          <div className="quest-list">{complete.map(card)}</div>
        </details>
      )}
      {goals.length === 0 && (
        <Empty title={active.length ? 'No quests for this date' : 'Choose your first goal'}>
          {active.length ? (
            'Try a different date.'
          ) : (
            <button className="button primary" onClick={onCreate}>
              Create goal
              <Plus size={17} />
            </button>
          )}
        </Empty>
      )}
    </section>
  );
}
