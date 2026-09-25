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
  days: number[];
  unit: string;
  target: number;
  shared: boolean;
  archived: boolean;
  achieved: boolean;
  created_at: string;
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
  created_at: string;
};
export type Profile = { id: string; name: string; avatar: string; timezone: string };
export type Reaction = { checkin_id: string; user_id: string; emoji: string; seen: boolean };
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
export const weekday = (day: string) => new Date(day + 'T12:00:00Z').getUTCDay();
export const shiftDay = (day: string, n: number) => {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const levelFor = (xp: number) => Math.floor(xp / 100) + 1;
export const ranks = [
  'Awakening',
  'Finding rhythm',
  'Gathering strength',
  'In your element',
  'Limitless',
];
export const rankFor = (level: number) => ranks[Math.min(4, Math.floor((level - 1) / 5))];
