export type Mark = 'apex' | 'orbit' | 'prism' | 'crest' | 'pulse' | 'eclipse';
export type Target = {
  measure: 'days' | 'quantity';
  period: 'week' | 'month';
  target: number;
  unit: string;
};
export type Period = Target & {
  id: string;
  run_id: string;
  goal_id: string;
  user_id: string;
  starts_on: string;
  ends_on: string;
  effective_on: string;
  grace: boolean;
  amount: number;
  achieved: boolean;
  run_ends_on?: string | null;
};
export type Goal = {
  id: string;
  user_id: string;
  title: string;
  category: 'health' | 'career' | 'personal';
  reason: string;
  milestone: string;
  action: string;
  small_action: string;
  cue: string;
  shared: boolean;
  archived: boolean;
  created_at: string;
  timezone: string;
  unit: string;
  current_period: Period | null;
  pending: (Target & { effective_on: string }) | null;
  run: {
    id: string;
    starts_on: string;
    ends_on: string | null;
    week_streak: number;
    month_streak: number;
  } | null;
};
export type Entry = {
  id: string;
  user_id: string;
  goal_id: string;
  day: string;
  status: 'full' | 'small' | 'skipped';
  quantity: number;
  shared_note: string;
  xp: number;
  period_id: string | null;
  created_at: string;
};
export type Profile = {
  id: string;
  name: string;
  avatar: Mark;
  timezone: string;
  onboarding_completed_at: string | null;
};
export type Reaction = { checkin_id: string; user_id: string; emoji: string; seen: boolean };
export type Bonus = {
  id: string;
  goal_id: string;
  user_id: string;
  run_id: string;
  kind: 'week' | 'month' | 'consistency';
  period_start: string;
  xp: number;
  created_at: string;
};
export type Dashboard = {
  profiles: Profile[];
  partner_id: string | null;
  goals: Goal[];
  entries: Entry[];
  notes: { checkin_id: string; body: string }[];
  periods: Period[];
  bonuses: Bonus[];
  reactions: Reaction[];
  total_xp: number;
};
export const dayKey = (
  date = new Date(),
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
export const shiftDay = (day: string, n: number) => {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const levelFor = (xp: number) => Math.floor(xp / 100) + 1;
export const rankFor = (level: number) =>
  ['Awakening', 'Finding rhythm', 'Gathering strength', 'In your element', 'Limitless'][
    Math.min(4, Math.floor((level - 1) / 5))
  ];
export const formatDay = (day: string) =>
  new Date(day + 'T12:00:00Z').toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
export const targetLabel = (p: Target) =>
  `${p.target} ${p.measure === 'days' ? 'days' : p.unit} / ${p.period}`;
