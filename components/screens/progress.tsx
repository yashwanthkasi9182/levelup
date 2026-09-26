'use client';
import { useState } from 'react';
import { Gift, Check } from 'lucide-react';
import { Streaks, GoalProgress, Empty } from './shared';
import { formatDay, type Dashboard, type Goal } from '@/lib/model';
export function ProgressScreen({
  data,
  userId,
  onLog,
}: {
  data: Dashboard;
  userId: string;
  onLog: (g: Goal, day: string) => void;
}) {
  const [visible, setVisible] = useState(30);
  const mine = data.goals.filter((g) => g.user_id === userId);
  const bonuses = data.bonuses.filter((b) => b.user_id === userId);
  const entries = data.entries.filter((e) => e.user_id === userId);
  return (
    <section className="screen">
      <div className="v2-heading">
        <div>
          <p className="eyebrow">{data.total_xp} TOTAL XP</p>
          <h1>Progress</h1>
        </div>
      </div>
      <div className="streak-grid">
        {mine
          .filter((g) => !g.archived)
          .map((g) => (
            <article key={g.id} className="panel">
              <h3>{g.title}</h3>
              <GoalProgress goal={g} />
              <Streaks goal={g} />
            </article>
          ))}
      </div>
      <div className="section-heading">
        <h2>Bonuses</h2>
        <span className="pill">{bonuses.reduce((n, b) => n + b.xp, 0)} XP</span>
      </div>
      {bonuses.length ? (
        <div className="bonus-list">
          {bonuses.slice(0, visible).map((b) => (
            <article className="bonus-row" key={b.id}>
              <span className="bonus-icon">
                <Gift size={18} />
              </span>
              <div>
                <strong>{mine.find((g) => g.id === b.goal_id)?.title}</strong>
                <small>
                  {b.kind === 'consistency'
                    ? 'Monthly consistency'
                    : b.kind === 'week'
                      ? 'Weekly target'
                      : 'Monthly target'}{' '}
                  · {formatDay(b.period_start)}
                </small>
              </div>
              <b>+{b.xp}</b>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Your first bonus is ahead">
          Weekly target +50 XP · Monthly target +100 XP
        </Empty>
      )}
      <div className="section-heading">
        <h2>History</h2>
        <span className="muted">{entries.length} entries</span>
      </div>
      <div className="history">
        {entries.slice(0, visible).map((e) => {
          const goal = mine.find((g) => g.id === e.goal_id);
          if (!goal) return null;
          const p = data.periods.find((p) => p.id === e.period_id);
          const note = data.notes.find((n) => n.checkin_id === e.id)?.body;
          return (
            <button className="history-entry" key={e.id} onClick={() => onLog(goal, e.day)}>
              <span className={`history-marker ${e.status}`}>
                <Check size={14} />
              </span>
              <span className="history-body">
                <span className="row spread">
                  <strong>{goal.title}</strong>
                  <span className="history-date">{formatDay(e.day)}</span>
                </span>
                <small>
                  {p?.measure === 'quantity'
                    ? `${e.quantity} ${p.unit}`
                    : e.status === 'full'
                      ? 'Full action'
                      : e.status === 'small'
                        ? 'Smaller action'
                        : 'Skipped'}{' '}
                  · {e.xp} XP
                </small>
                {note && <p>{note}</p>}
                <span className="entry-reactions">
                  {data.reactions
                    .filter((r) => r.checkin_id === e.id)
                    .map((r) => (
                      <span key={r.user_id}>{r.emoji}</span>
                    ))}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {!entries.length && <Empty title="Nothing logged yet" />}
      {Math.max(entries.length, bonuses.length) > visible && (
        <button className="text-button" onClick={() => setVisible((v) => v + 30)}>
          Show more
        </button>
      )}
    </section>
  );
}
