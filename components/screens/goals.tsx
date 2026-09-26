'use client';
import { Plus, Pencil, Archive, Users, Lock } from 'lucide-react';
import { GoalProgress, Streaks, categoryIcons } from './shared';
import { formatDay, targetLabel, type Goal } from '@/lib/model';
export function GoalsScreen({
  goals,
  onEdit,
  onCreate,
  onArchive,
}: {
  goals: Goal[];
  onEdit: (g: Goal) => void;
  onCreate: () => void;
  onArchive: (g: Goal, archive: boolean) => void;
}) {
  const active = goals.filter((g) => !g.archived);
  return (
    <section className="screen">
      <div className="v2-heading">
        <div>
          <p className="eyebrow">{active.length} OF 3 ACTIVE</p>
          <h1>Goals</h1>
        </div>
        <button className="button primary compact" disabled={active.length >= 3} onClick={onCreate}>
          <Plus size={18} />
          New goal
        </button>
      </div>
      <div className="goals-grid">
        {active.map((goal) => {
          const Icon = categoryIcons[goal.category];
          return (
            <article key={goal.id} className={`goal-card ${goal.category}`}>
              <div className="row spread">
                <span className="quest-icon">
                  <Icon size={23} />
                </span>
                <button
                  className="icon-button"
                  aria-label={`Edit ${goal.title}`}
                  onClick={() => onEdit(goal)}
                >
                  <Pencil size={17} />
                </button>
              </div>
              <h2 className="goal-title-v2">{goal.title}</h2>
              <GoalProgress goal={goal} />
              <Streaks goal={goal} />
              {goal.pending && (
                <div className="pending-target">
                  <small>From {formatDay(goal.pending.effective_on)}</small>
                  <p>{targetLabel(goal.pending)}</p>
                </div>
              )}
              {goal.reason && <p className="goal-reason">{goal.reason}</p>}
              <div className="goal-bottom">
                <span>
                  {goal.shared ? (
                    <>
                      <Users size={14} />
                      Shared
                    </>
                  ) : (
                    <>
                      <Lock size={14} />
                      Private
                    </>
                  )}
                </span>
                <button
                  className="icon-button"
                  aria-label={`Archive ${goal.title}`}
                  onClick={() => onArchive(goal, true)}
                >
                  <Archive size={17} />
                </button>
              </div>
            </article>
          );
        })}
        {active.length < 3 && (
          <button className="add-goal-card" onClick={onCreate}>
            <span>
              <Plus size={25} />
            </span>
            <h3>New goal</h3>
          </button>
        )}
      </div>
      {goals.some((g) => g.archived) && (
        <section className="archive-section">
          <h3>Archived</h3>
          {goals
            .filter((g) => g.archived)
            .map((g) => (
              <div className="archive-row" key={g.id}>
                <span>{g.title}</span>
                <button
                  className="text-button"
                  disabled={active.length >= 3}
                  onClick={() => onArchive(g, false)}
                >
                  Start new run
                </button>
              </div>
            ))}
        </section>
      )}
    </section>
  );
}
