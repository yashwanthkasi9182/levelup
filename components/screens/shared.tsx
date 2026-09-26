import { Check, Flame, CalendarDays, Dumbbell, BookOpen, Feather } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { Goal } from '@/lib/model';
export const categoryIcons = { health: Dumbbell, career: BookOpen, personal: Feather };
export function GoalProgress({ goal }: { goal: Goal }) {
  const p = goal.current_period;
  if (!p) return null;
  return (
    <div className="goal-progress">
      <div className="row spread">
        <span>
          <b>{Number(p.amount).toLocaleString()}</b> / {p.target} {p.unit}
        </span>
        <span>
          {p.achieved ? (
            <>
              <Check size={13} />
              Target met
            </>
          ) : p.period === 'week' ? (
            'This week'
          ) : (
            'This month'
          )}
        </span>
      </div>
      <Progress
        value={Math.min(100, (p.amount / p.target) * 100)}
        aria-label={`${p.amount} of ${p.target} ${p.unit}`}
      />
      {p.grace && <small>First period · no streak penalty</small>}
    </div>
  );
}
export function Streaks({ goal }: { goal: Goal }) {
  const r = goal.run;
  if (!r) return null;
  return (
    <div className="streaks">
      {goal.current_period?.period !== 'month' && (
        <span>
          <Flame size={15} />
          <b>{r.week_streak}</b> weeks
        </span>
      )}
      <span>
        <CalendarDays size={15} />
        <b>{r.month_streak}</b> months
      </span>
    </div>
  );
}
export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
