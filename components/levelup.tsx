'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  ChevronsUp,
  Flame,
  Heart,
  Mountain,
  Moon,
  Sun,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Plus,
  LogOut,
  Volume2,
  VolumeX,
  Dumbbell,
  BookOpen,
  Feather,
  Link as LinkIcon,
  Copy,
  RefreshCw,
  LoaderCircle,
  Lock,
  CheckCheck,
  Archive,
  Pencil,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  dayKey,
  weekday,
  shiftDay,
  levelFor,
  rankFor,
  type Goal,
  type Entry,
  type Profile,
  type Reaction,
} from '@/lib/model';
import { playSound } from '@/lib/sound';
import { useWebMCP } from '@/lib/use-webmcp';
import { GoalForm } from './goal-form';
import { CheckinForm } from './checkin-form';
const icons = { health: Dumbbell, career: BookOpen, personal: Feather };
const labels = {
  health: 'HEALTH & MOVEMENT',
  career: 'CAREER & LEARNING',
  personal: 'PERSONAL GROWTH',
};
const avatars = { spark: Sparkles, moon: Moon, mountain: Mountain, sun: Sun };
const nav = [
  { id: 'today', label: 'Today', icon: Flame },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'partner', label: 'Partner', icon: Users },
];
type Note = { checkin_id: string; body: string };
async function allRows<T>(table: string): Promise<T[]> {
  let out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(table === 'notes' || table === 'reactions' ? 'checkin_id' : 'id')
      .range(from, from + 999);
    if (error) throw error;
    out = out.concat(data as T[]);
    if (data.length < 1000) return out;
  }
}
function Emblem({ level = 1, large = false }: { level?: number; large?: boolean }) {
  return (
    <div
      className={`emblem ${large ? 'large' : ''} tier-${Math.min(4, Math.floor((level - 1) / 5))}`}
      aria-label={`Level ${level} emblem`}
    >
      <div className="emblem-ring" />
      <div className="emblem-core">
        <ChevronsUp strokeWidth={1.2} />
      </div>
      <span className="emblem-orbit" />
    </div>
  );
}
function Empty({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: typeof Target;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={26} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Auth() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin,
          data: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <div className="auth-art">
        <a className="brand" href="/">
          <ChevronsUp />
          levelup<span>®</span>
        </a>
        <div className="auth-art-body">
          <p className="eyebrow">A PERSONAL PRACTICE</p>
          <h1>
            Become someone
            <br />
            you’re proud of.
          </h1>
          <p>
            One small promise.
            <br />
            Kept, day after day.
          </p>
          <Emblem large level={6} />
        </div>
        <div className="auth-foot">
          <span>YOUR PACE. YOUR PROGRESS.</span>
          <span>01 — ∞</span>
        </div>
      </div>
      <section className="auth-form">
        <p className="eyebrow">YOUR NEXT CHAPTER</p>
        <h2>
          Start where
          <br />
          you are.
        </h2>
        <p className="muted">Make room for what matters. We’ll help you keep showing up.</p>
        {sent ? (
          <div className="sent-state">
            <CheckCheck size={28} />
            <h3>Check your inbox.</h3>
            <p>
              We sent a sign-in link to <strong>{email}</strong>. Open it on this device to
              continue.
            </p>
            <button className="text-button" onClick={() => setSent(false)}>
              Use another email or resend
            </button>
          </div>
        ) : (
          <form className="form-stack" onSubmit={signIn}>
            <label>
              Email address
              <input
                required
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button className="button primary" disabled={busy}>
              {busy ? 'Sending your link…' : 'Continue with email'}
              <ArrowRight size={18} />
            </button>
            <small>No password to remember. Just a secure sign-in link.</small>
          </form>
        )}
        <div className="auth-note">
          <Lock size={15} />
          <span>Your goals start private. Share only what you choose.</span>
        </div>
      </section>
    </main>
  );
}
export default function LevelUp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [tab, setTab] = useState('today');
  const [day, setDay] = useState(dayKey());
  const [clockTick, setClockTick] = useState(0);
  const [sound, setSound] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [goalModal, setGoalModal] = useState<Goal | 'new' | null>(null);
  const [checkin, setCheckin] = useState<{ goal: Goal; day: string } | null>(null);
  const [settings, setSettings] = useState(false);
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    run: () => Promise<void>;
  } | null>(null);
  const [mutating, setMutating] = useState(false);
  const [invite, setInvite] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [partnerBusy, setPartnerBusy] = useState(false);
  const [userName, setUserName] = useState('');
  const [userAvatar, setUserAvatar] = useState('spark');
  useWebMCP(user?.id, goals, () => setGoalModal('new'));
  const fetchedUser = useRef<string | null>(null);
  const loadVersion = useRef(0);
  useEffect(() => {
    setSound(localStorage.getItem('levelup-sound') === 'true');
    setReduced(localStorage.getItem('levelup-motion') === 'true');
    const code = new URLSearchParams(window.location.search).get('invite');
    if (code) {
      localStorage.setItem('levelup-invite', code);
      window.history.replaceState(null, '', '/');
    }
    setInviteCode(localStorage.getItem('levelup-invite') || '');
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) toast.error(error.message);
      setUser(data.session?.user || null);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reduced);
  }, [reduced]);
  const load = useCallback(
    async (silent = false) => {
      if (!user) return;
      const version = ++loadVersion.current;
      if (!silent) setLoading(true);
      try {
        const [p, g, e, n, r, connection] = await Promise.all([
          allRows<Profile>('profiles'),
          allRows<Goal>('goals'),
          allRows<Entry>('checkins'),
          allRows<Note>('notes'),
          allRows<Reaction>('reactions'),
          supabase.from('partners').select('partner_id').eq('user_id', user.id).maybeSingle(),
        ]);
        if (connection.error) throw connection.error;
        if (version !== loadVersion.current) return;
        setProfiles(p);
        setGoals(g.sort((a, b) => a.created_at.localeCompare(b.created_at)));
        setEntries(
          e.sort((a, b) => b.day.localeCompare(a.day) || b.created_at.localeCompare(a.created_at)),
        );
        setNotes(n);
        setReactions(r);
        setPartnerId(connection.data?.partner_id || null);
        setError('');
        const me = p.find((x) => x.id === user.id);
        if (fetchedUser.current !== user.id) {
          fetchedUser.current = user.id;
          setDay(dayKey(new Date(), me?.timezone || 'UTC'));
          setUserName(me?.name || 'Player');
          setUserAvatar(me?.avatar || 'spark');
        }
      } catch (e) {
        if (version === loadVersion.current && !silent)
          setError((e as Error).message || 'Could not load your progress.');
      } finally {
        if (version === loadVersion.current) setLoading(false);
      }
    },
    [user],
  );
  useEffect(() => {
    if (user) void load();
    else {
      loadVersion.current++;
      fetchedUser.current = null;
      setProfiles([]);
      setGoals([]);
      setEntries([]);
      setNotes([]);
      setReactions([]);
      setPartnerId(null);
    }
  }, [user, load]);
  useEffect(() => {
    if (!user) return;
    const tick = () => {
      if (document.visibilityState === 'visible') {
        setClockTick((v) => v + 1);
        void load(true);
      }
    };
    const timer = setInterval(tick, 30000);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', tick);
    };
  }, [user, load]);
  const profile = profiles.find((p) => p.id === user?.id);
  const partner = profiles.find((p) => p.id === partnerId);
  const today = dayKey(new Date(), profile?.timezone || 'UTC');
  void clockTick;
  const mine = goals.filter((g) => g.user_id === user?.id);
  const active = mine.filter((g) => !g.archived);
  const myEntries = entries.filter((e) => e.user_id === user?.id);
  const xp = myEntries.reduce((sum, e) => sum + e.xp, 0);
  const level = levelFor(xp);
  const unread = reactions.filter((r) => !r.seen && myEntries.some((e) => e.id === r.checkin_id));
  const scheduled = mine.filter(
    (g) =>
      (!g.archived &&
        g.days.includes(weekday(day)) &&
        day >= dayKey(new Date(g.created_at), profile?.timezone || 'UTC')) ||
      myEntries.some((e) => e.goal_id === g.id && e.day === day),
  );
  const dayEntries = myEntries.filter((e) => e.day === day);
  const done = scheduled.filter((g) =>
    dayEntries.some((e) => e.goal_id === g.id && e.status !== 'skipped'),
  ).length;
  const week = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6));
  const weekEntries = myEntries.filter((e) => week.includes(e.day));
  const planned = week.reduce(
    (total, d) =>
      total +
      mine.filter(
        (g) =>
          (!g.archived &&
            g.days.includes(weekday(d)) &&
            d >= dayKey(new Date(g.created_at), profile?.timezone || 'UTC')) ||
          myEntries.some((e) => e.day === d && e.goal_id === g.id),
      ).length,
    0,
  );
  const completed = weekEntries.filter((e) => e.status !== 'skipped').length;
  const Avatar = avatars[(profile?.avatar || 'spark') as keyof typeof avatars] || Sparkles;
  const lastAction = myEntries.find((e) => e.status !== 'skipped');
  const returning = Boolean(lastAction && lastAction.day < shiftDay(today, -2));
  async function refresh() {
    await load(true);
  }
  async function updateGoal(goal: Goal, values: Partial<Goal>) {
    const { error } = await supabase.from('goals').update(values).eq('id', goal.id);
    if (error) throw error;
    await refresh();
  }
  async function react(entry: Entry, emoji: string) {
    setPartnerBusy(true);
    try {
      const current = reactions.find((r) => r.checkin_id === entry.id && r.user_id === user?.id);
      const { error } = await supabase.rpc('react_to', {
        cid: entry.id,
        reaction: current?.emoji === emoji ? null : emoji,
      });
      if (error) throw error;
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPartnerBusy(false);
    }
  }
  async function accept() {
    setPartnerBusy(true);
    try {
      let code = inviteCode.trim();
      if (code.includes('://')) code = new URL(code).searchParams.get('invite') || '';
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code))
        throw new Error('Paste a valid invitation link or code.');
      const { error } = await supabase.rpc('accept_invite', { code });
      if (error) throw error;
      localStorage.removeItem('levelup-invite');
      setInviteCode('');
      await refresh();
      toast.success('You’re in each other’s corner.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPartnerBusy(false);
    }
  }
  async function createInvite() {
    setPartnerBusy(true);
    try {
      const { data, error } = await supabase.rpc('create_invite');
      if (error) throw error;
      setInvite(`${window.location.origin}/?invite=${data}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPartnerBusy(false);
    }
  }
  const tabChange = (value: string) => {
    setTab(value);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  if (!authReady)
    return (
      <>
        <div className="loading-screen">
          <ChevronsUp />
          <p>levelup</p>
        </div>
        <Toaster />
      </>
    );
  if (!user)
    return (
      <>
        <Auth />
        <Toaster theme="dark" position="top-center" />
      </>
    );
  return (
    <div className={reduced ? 'app reduce-motion' : 'app'}>
      <Toaster theme="dark" position="top-center" />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <a href="/" className="brand">
          <ChevronsUp />
          levelup<span>®</span>
        </a>
        <div className="topbar-right">
          <span className="top-date">
            {new Intl.DateTimeFormat('en', {
              month: 'short',
              day: 'numeric',
              timeZone: profile?.timezone || 'UTC',
            }).format(new Date())}
          </span>
          <button
            className="icon-button"
            aria-label={sound ? 'Mute sounds' : 'Enable sounds'}
            onClick={() => {
              const next = !sound;
              setSound(next);
              localStorage.setItem('levelup-sound', String(next));
              if (next) playSound();
            }}
          >
            {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>
          <button
            className="avatar"
            aria-label="Open profile and settings"
            onClick={() => setSettings(true)}
          >
            <Avatar size={19} />
          </button>
        </div>
      </header>
      <Tabs value={tab} onValueChange={tabChange} className="app-tabs">
        <TabsList className="bottom-nav" aria-label="Main navigation">
          {nav.map((n) => (
            <TabsTrigger value={n.id} key={n.id}>
              <n.icon size={20} />
              <span>{n.label}</span>
              {n.id === 'partner' && unread.length > 0 && (
                <span
                  className="notification-dot"
                  aria-label={`${unread.length} unread reactions`}
                />
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        <main id="main" className="main-shell">
          {loading ? (
            <div className="loading-screen">
              <LoaderCircle className="spin" />
              <p>Gathering your progress…</p>
            </div>
          ) : error ? (
            <section className="panel error-panel">
              <h2>Let’s get you connected.</h2>
              <p>
                Your progress couldn’t load. If this is your first run, apply the Supabase migration
                in the project README.
              </p>
              <code>{error}</code>
              <button className="button primary" onClick={() => void load()}>
                <RefreshCw size={17} />
                Try again
              </button>
            </section>
          ) : (
            <>
              <TabsContent value="today" className="screen">
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">
                      {new Intl.DateTimeFormat('en', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        timeZone: profile?.timezone || 'UTC',
                      }).format(new Date())}
                    </p>
                    <h1>
                      {returning
                        ? 'Good to have you back.'
                        : `Make today count${profile?.name && profile.name !== 'Player' ? `, ${profile.name.split(' ')[0]}` : ''}.`}
                    </h1>
                    <p className="muted">
                      {returning
                        ? 'Your progress is still here. A smaller step is a good place to start.'
                        : 'A little effort. A little closer to who you want to be.'}
                    </p>
                  </div>
                  <span className="chapter-mark">
                    CHAPTER
                    <br />
                    <b>{String(level).padStart(2, '0')}</b>
                  </span>
                </div>
                <div className="today-grid">
                  <section className="level-card">
                    <div>
                      <div className="row spread">
                        <p className="eyebrow">YOUR ASCENT</p>
                        <span className="rank-badge">{rankFor(level)}</span>
                      </div>
                      <div className="level-number">
                        <span>LEVEL</span>
                        <b>{String(level).padStart(2, '0')}</b>
                      </div>
                      <p className="level-caption">Built one promise at a time.</p>
                      <div className="level-progress">
                        <div className="row spread">
                          <span>{xp % 100} / 100 XP</span>
                          <span>
                            Level {level + 1}
                            <ArrowUpRight size={13} />
                          </span>
                        </div>
                        <Progress value={xp % 100} aria-label="Progress toward next level" />
                      </div>
                    </div>
                    <Emblem level={level} />
                  </section>
                  <section className="daily-summary">
                    <div className="row spread">
                      <span className="eyebrow">TODAY’S RHYTHM</span>
                      <Sun size={19} />
                    </div>
                    <div className="summary-stat">
                      {myEntries.filter((e) => e.day === today && e.status !== 'skipped').length}
                      <span>
                        {' '}
                        /{' '}
                        {mine.filter((g) => !g.archived && g.days.includes(weekday(today))).length}
                      </span>
                    </div>
                    <p>small promises kept</p>
                    <div className="summary-footer">
                      <span>{weekEntries.reduce((n, e) => n + e.xp, 0)} XP this week</span>
                      <TrendingUp size={17} />
                    </div>
                  </section>
                </div>
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">SHOW UP FOR YOURSELF</p>
                    <h2>
                      Your daily quests<span className="count">{scheduled.length}</span>
                    </h2>
                  </div>
                  <button
                    className="icon-button outlined"
                    aria-label="Create goal"
                    disabled={active.length >= 3}
                    onClick={() => setGoalModal('new')}
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="week-strip" aria-label="Choose a day">
                  {week.map((d) => {
                    const checked = myEntries.some((e) => e.day === d && e.status !== 'skipped');
                    return (
                      <button
                        key={d}
                        className={day === d ? 'selected' : ''}
                        aria-pressed={day === d}
                        onClick={() => setDay(d)}
                      >
                        <span>
                          {new Date(d + 'T12:00:00Z')
                            .toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' })
                            .slice(0, 3)}
                        </span>
                        <b>{Number(d.slice(-2))}</b>
                        <i className={checked ? 'has-progress' : ''} />
                      </button>
                    );
                  })}
                </div>
                <div className="row spread quest-date">
                  <span>
                    {day === today
                      ? 'Today'
                      : new Date(day + 'T12:00:00Z').toLocaleDateString('en', {
                          month: 'short',
                          day: 'numeric',
                          timeZone: 'UTC',
                        })}
                  </span>
                  <span>
                    {done} of {scheduled.length} completed
                  </span>
                </div>
                <div className="quest-list">
                  {scheduled.map((goal, index) => {
                    const Icon = icons[goal.category];
                    const entry = dayEntries.find((e) => e.goal_id === goal.id);
                    return (
                      <button
                        key={goal.id}
                        className={`quest-card ${goal.category} ${entry?.status === 'full' ? 'is-complete' : ''}`}
                        style={{ animationDelay: `${index * 65}ms` }}
                        onClick={() => setCheckin({ goal, day })}
                      >
                        <span className="quest-icon">
                          <Icon size={23} strokeWidth={1.5} />
                        </span>
                        <span className="quest-copy">
                          <span className="eyebrow">{goal.title}</span>
                          <strong>{goal.action}</strong>
                          <span className="quest-meta">
                            {entry ? (
                              <>
                                <Check size={13} />
                                {entry.status === 'full'
                                  ? 'Full quest complete'
                                  : entry.status === 'small'
                                    ? 'Smaller step complete'
                                    : 'Skipped today'}{' '}
                                · {entry.xp} XP
                              </>
                            ) : (
                              goal.cue || `${goal.target} ${goal.unit} · at your own pace`
                            )}
                          </span>
                        </span>
                        <span
                          className={`quest-action ${entry && entry.status !== 'skipped' ? 'checked' : ''}`}
                        >
                          {entry && entry.status !== 'skipped' ? (
                            <Check size={20} />
                          ) : (
                            <ArrowUpRight size={20} />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {!scheduled.length && (
                  <Empty
                    icon={active.length ? Moon : Target}
                    title={active.length ? 'Space to recharge.' : 'What do you want to grow?'}
                    action={
                      !active.length ? (
                        <button className="button primary" onClick={() => setGoalModal('new')}>
                          Create your first goal
                          <Plus size={17} />
                        </button>
                      ) : undefined
                    }
                  >
                    {active.length
                      ? 'No quests scheduled for this day. Rest is part of the rhythm.'
                      : 'Start with one goal that matters to you. Make the first step small enough to begin today.'}
                  </Empty>
                )}
                <div className="gentle-note">
                  <Feather size={18} />
                  <p>Low on energy? A smaller step still moves you forward.</p>
                </div>
              </TabsContent>
              <TabsContent value="goals" className="screen">
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">GIVE YOUR ENERGY A DIRECTION</p>
                    <h1>The things that matter.</h1>
                    <p className="muted">
                      Three goals. Enough room to grow, enough space to focus.
                    </p>
                  </div>
                  <button
                    className="button primary compact"
                    disabled={active.length >= 3}
                    onClick={() => setGoalModal('new')}
                  >
                    <Plus size={18} />
                    New goal
                  </button>
                </div>
                <div className="goals-grid">
                  {active.map((goal, index) => {
                    const Icon = icons[goal.category];
                    const sessions = myEntries.filter(
                      (e) => e.goal_id === goal.id && e.status !== 'skipped',
                    );
                    return (
                      <article key={goal.id} className={`goal-card ${goal.category}`}>
                        <div className="row spread">
                          <span className="quest-icon">
                            <Icon size={24} />
                          </span>
                          <span className="goal-index">0{index + 1} / 03</span>
                        </div>
                        <p className="eyebrow">{labels[goal.category]}</p>
                        <h2>{goal.title}</h2>
                        {goal.reason && <p className="goal-reason">{goal.reason}</p>}
                        <div className="milestone">
                          <span className="eyebrow">FIRST MILESTONE</span>
                          <p>{goal.milestone}</p>
                          <button
                            className={`text-button ${goal.achieved ? 'accent-text' : ''}`}
                            onClick={() => {
                              setConfirm({
                                title: goal.achieved
                                  ? 'Reopen this milestone?'
                                  : 'Milestone reached?',
                                description: goal.achieved
                                  ? 'You can keep working toward this milestone.'
                                  : 'Take a moment to recognise the work you put in. You can edit your goal to set the next milestone.',
                                run: async () => {
                                  await updateGoal(goal, { achieved: !goal.achieved });
                                  if (!goal.achieved && sound) playSound(true);
                                },
                              });
                            }}
                          >
                            <CheckCheck size={17} />
                            {goal.achieved ? 'Milestone achieved' : 'Mark as achieved'}
                          </button>
                        </div>
                        <div className="goal-facts">
                          <span>
                            <b>{sessions.length}</b>sessions
                          </span>
                          <span>
                            <b>
                              {sessions
                                .reduce((n, e) => n + Number(e.quantity), 0)
                                .toLocaleString()}
                            </b>
                            {goal.unit}
                          </span>
                        </div>
                        <div className="goal-schedule">
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                            <span key={i} className={goal.days.includes(i) ? 'on' : ''}>
                              {d}
                            </span>
                          ))}
                        </div>
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
                          <div className="row">
                            <button
                              className="icon-button"
                              aria-label={`Edit ${goal.title}`}
                              onClick={() => setGoalModal(goal)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Archive ${goal.title}`}
                              onClick={() =>
                                setConfirm({
                                  title: 'Make room for something new?',
                                  description:
                                    'This goal will leave your daily quests. Its history and earned XP stay with you.',
                                  run: async () => {
                                    await updateGoal(goal, { archived: true });
                                  },
                                })
                              }
                            >
                              <Archive size={16} />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  {active.length < 3 && (
                    <button className="add-goal-card" onClick={() => setGoalModal('new')}>
                      <span>
                        <Plus size={26} />
                      </span>
                      <h3>{active.length ? 'Room for another chapter.' : 'Your first chapter.'}</h3>
                      <p>{active.length} of 3 goals active</p>
                    </button>
                  )}
                </div>
                {mine.some((g) => g.archived) && (
                  <section className="archive-section">
                    <h3>Previous chapters</h3>
                    {mine
                      .filter((g) => g.archived)
                      .map((g) => (
                        <div key={g.id} className="archive-row">
                          <span>{g.title}</span>
                          <button
                            className="text-button"
                            disabled={active.length >= 3}
                            onClick={async () => {
                              try {
                                await updateGoal(g, { archived: false });
                              } catch (e) {
                                toast.error((e as Error).message);
                              }
                            }}
                          >
                            Restore
                            <ArrowUpRight size={15} />
                          </button>
                        </div>
                      ))}
                  </section>
                )}
              </TabsContent>
              <TabsContent value="progress" className="screen">
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">PROOF YOU’RE MOVING FORWARD</p>
                    <h1>Look how far you’ve come.</h1>
                    <p className="muted">The small things add up. Here’s your evidence.</p>
                  </div>
                </div>
                <section className="progress-hero">
                  <Emblem level={level} />
                  <div>
                    <p className="eyebrow">{rankFor(level)}</p>
                    <h2>Level {String(level).padStart(2, '0')}</h2>
                    <p>
                      {xp.toLocaleString()} XP earned ·{' '}
                      {myEntries.filter((e) => e.status !== 'skipped').length} promises kept
                    </p>
                    <Progress value={xp % 100} aria-label="Level progress" />
                    <small>{100 - (xp % 100)} XP until your next level</small>
                  </div>
                </section>
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">YOUR WEEKLY REVIEW</p>
                    <h2>The last seven days.</h2>
                  </div>
                  <span className="pill">
                    {completed} / {planned} sessions
                  </span>
                </div>
                <div className="review-grid">
                  <section className="panel activity-panel">
                    <div className="activity-chart">
                      {week.map((d) => {
                        const full = myEntries.filter(
                          (e) => e.day === d && e.status === 'full',
                        ).length;
                        const small = myEntries.filter(
                          (e) => e.day === d && e.status === 'small',
                        ).length;
                        return (
                          <div key={d} className="activity-column">
                            <span className="chart-value">{full + small || '—'}</span>
                            <div
                              className="bar-track"
                              aria-label={`${d}: ${full} full, ${small} smaller`}
                            >
                              <div
                                className="bar-small"
                                style={{ height: `${(small / 3) * 100}%` }}
                              />
                              <div
                                className="bar-full"
                                style={{ height: `${(full / 3) * 100}%` }}
                              />
                            </div>
                            <span>
                              {new Date(d + 'T12:00:00Z')
                                .toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' })
                                .slice(0, 1)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="chart-legend">
                      <span>
                        <i />
                        Full quest
                      </span>
                      <span>
                        <i />
                        Smaller step
                      </span>
                    </div>
                  </section>
                  <section className="panel review-copy">
                    <p className="eyebrow">TAKE A MOMENT</p>
                    <h3>
                      {completed
                        ? 'What made showing up easier?'
                        : 'Make your first step an easy one.'}
                    </h3>
                    <p>
                      {completed
                        ? `You made progress ${completed} time${completed === 1 ? '' : 's'} this week, including ${weekEntries.filter((e) => e.status === 'small').length} smaller steps. Keep what worked; adjust what didn’t.`
                        : 'Choose a time, connect it to a routine, and give yourself a smaller version for busy days.'}
                    </p>
                    <button className="text-button" onClick={() => tabChange('goals')}>
                      Adjust next week’s plan
                      <ArrowUpRight size={17} />
                    </button>
                    <small>Planned sessions use your current schedule.</small>
                  </section>
                </div>
                <div className="section-heading">
                  <h2>Your field notes.</h2>
                  <span className="muted">Most recent first</span>
                </div>
                <div className="history">
                  {myEntries.slice(0, 50).map((entry) => {
                    const goal = mine.find((g) => g.id === entry.goal_id);
                    if (!goal) return null;
                    const note = notes.find((n) => n.checkin_id === entry.id)?.body;
                    return (
                      <button
                        key={entry.id}
                        className="history-entry"
                        onClick={() => setCheckin({ goal, day: entry.day })}
                      >
                        <span className={`history-marker ${entry.status}`}>
                          <Check size={15} />
                        </span>
                        <span className="history-body">
                          <span className="row spread">
                            <strong>{goal.title}</strong>
                            <span className="history-date">
                              {entry.day.slice(5).replace('-', '/')}
                            </span>
                          </span>
                          <small>
                            {entry.status === 'full'
                              ? 'Full quest'
                              : entry.status === 'small'
                                ? 'Smaller step'
                                : 'Skipped'}{' '}
                            · {entry.quantity} {goal.unit} · +{entry.xp} XP
                          </small>
                          {note && <p>{note}</p>}
                          <span className="entry-reactions">
                            {reactions
                              .filter((r) => r.checkin_id === entry.id)
                              .map((r) => (
                                <span key={r.user_id}>{r.emoji}</span>
                              ))}
                          </span>
                        </span>
                        <Pencil size={15} className="muted" />
                      </button>
                    );
                  })}
                  {!myEntries.length && (
                    <Empty icon={BookOpen} title="A story waiting to be written.">
                      Your check-ins and reflections will live here.
                    </Empty>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="partner" className="screen">
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">SOMEONE IN YOUR CORNER</p>
                    <h1>Better, together.</h1>
                    <p className="muted">A little encouragement goes a long way.</p>
                  </div>
                </div>
                {unread.length > 0 && (
                  <section className="reaction-inbox">
                    <div>
                      <strong>A little love for your effort.</strong>
                      <p>
                        {unread.map((r) => r.emoji).join(' ')} Your partner reacted to{' '}
                        {unread.length} of your check-ins.
                      </p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Mark reactions as read"
                      onClick={async () => {
                        const { error } = await supabase.rpc('mark_reactions_seen');
                        if (error) toast.error(error.message);
                        else await refresh();
                      }}
                    >
                      <CheckCheck size={20} />
                    </button>
                  </section>
                )}
                {!partnerId ? (
                  <div className="partner-onboarding">
                    <section className="partner-invite panel">
                      <div className="partner-symbol">
                        <span>
                          <Heart size={26} />
                        </span>
                        <LinkIcon size={20} />
                        <span>
                          <Sparkles size={26} />
                        </span>
                      </div>
                      <h2>
                        Share the journey.
                        <br />
                        Keep your own pace.
                      </h2>
                      <p>
                        Invite one person you trust. Celebrate the little wins, and show up for each
                        other on the harder days.
                      </p>
                      <button
                        className="button primary"
                        disabled={partnerBusy}
                        onClick={createInvite}
                      >
                        {partnerBusy
                          ? 'Creating…'
                          : invite
                            ? 'Create a fresh invitation'
                            : 'Create invitation'}
                        <ArrowUpRight size={18} />
                      </button>
                      {invite && (
                        <div className="invite-link">
                          <label>
                            Invitation link · valid for 7 days
                            <input readOnly value={invite} onFocus={(e) => e.target.select()} />
                          </label>
                          <button
                            className="text-button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(invite);
                                toast.success('Invitation copied.');
                              } catch {
                                toast.error('Select the link and copy it manually.');
                              }
                            }}
                          >
                            <Copy size={16} />
                            Copy link
                          </button>
                        </div>
                      )}
                      <small>Only goals you choose to share will be visible.</small>
                    </section>
                    <section className="panel accept-panel">
                      <p className="eyebrow">ALREADY HAVE AN INVITE?</p>
                      <h3>Your corner is waiting.</h3>
                      <label>
                        Invitation link or code
                        <input
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value)}
                          placeholder="Paste your invitation here"
                        />
                      </label>
                      <button
                        className="button secondary"
                        disabled={!inviteCode || partnerBusy}
                        onClick={accept}
                      >
                        Accept invitation
                        <ArrowRight size={18} />
                      </button>
                    </section>
                  </div>
                ) : (
                  <>
                    <section className="partner-banner">
                      <div className="partner-avatar">
                        <Heart size={26} />
                      </div>
                      <div>
                        <p className="eyebrow">YOUR ACCOUNTABILITY PARTNER</p>
                        <h2>{partner?.name || 'Your partner'}</h2>
                        <p>Different goals. The same corner.</p>
                      </div>
                      <button
                        className="text-button muted"
                        onClick={() =>
                          setConfirm({
                            title: 'Disconnect your partner?',
                            description:
                              'You will both lose access to each other’s shared goals and progress. Your personal history stays intact.',
                            run: async () => {
                              const { error } = await supabase.rpc('disconnect_partner');
                              if (error) throw error;
                              await refresh();
                            },
                          })
                        }
                      >
                        Disconnect
                      </button>
                    </section>
                    <div className="section-heading">
                      <h2>Their current chapters.</h2>
                      <span className="pill">Shared with you</span>
                    </div>
                    <div className="partner-goals">
                      {goals
                        .filter((g) => g.user_id === partnerId && !g.archived)
                        .map((g) => (
                          <article key={g.id} className="panel">
                            <p className="eyebrow">{labels[g.category]}</p>
                            <h3>{g.title}</h3>
                            <p>{g.milestone}</p>
                            {g.achieved && <span className="pill">Milestone achieved</span>}
                          </article>
                        ))}
                    </div>
                    <div className="section-heading">
                      <h2>A little encouragement.</h2>
                      <button
                        className="icon-button"
                        aria-label="Refresh partner progress"
                        onClick={() => void refresh()}
                      >
                        <RefreshCw size={18} />
                      </button>
                    </div>
                    <div className="partner-feed">
                      {entries
                        .filter((e) => e.user_id === partnerId)
                        .slice(0, 30)
                        .map((entry) => {
                          const goal = goals.find((g) => g.id === entry.goal_id);
                          if (!goal) return null;
                          const mineReaction = reactions.find(
                            (r) => r.checkin_id === entry.id && r.user_id === user.id,
                          );
                          return (
                            <article key={entry.id} className="feed-entry">
                              <div className="row spread">
                                <span className="eyebrow">{goal.title}</span>
                                <small>{entry.day}</small>
                              </div>
                              <h3>
                                {entry.status === 'full'
                                  ? goal.action
                                  : entry.status === 'small'
                                    ? goal.small_action
                                    : 'Taking a pause today.'}
                              </h3>
                              <p>
                                {entry.status === 'skipped'
                                  ? 'A fresh start is always there.'
                                  : `${entry.quantity} ${goal.unit} · ${entry.status === 'full' ? 'Full quest' : 'Smaller step'}`}
                              </p>
                              {entry.shared_note && <blockquote>{entry.shared_note}</blockquote>}
                              <div className="reaction-buttons">
                                {['❤️', '🔥', '👏', '💪'].map((emoji) => (
                                  <button
                                    key={emoji}
                                    disabled={partnerBusy}
                                    aria-label={`React ${emoji}`}
                                    aria-pressed={mineReaction?.emoji === emoji}
                                    onClick={() => void react(entry, emoji)}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </article>
                          );
                        })}
                      {!entries.some((e) => e.user_id === partnerId) && (
                        <Empty icon={Heart} title="The next win is worth celebrating.">
                          Your partner’s shared check-ins will appear here. You can choose shared
                          goals from the Goals screen.
                        </Empty>
                      )}
                    </div>
                  </>
                )}
              </TabsContent>
              <footer className="page-footer">
                <span>SMALL ACTIONS. REAL PROGRESS.</span>
                <ChevronsUp size={18} />
                <span>LEVELUP</span>
              </footer>
            </>
          )}
        </main>
      </Tabs>
      <Dialog
        open={goalModal !== null}
        onOpenChange={(open) => {
          if (!open) setGoalModal(null);
        }}
      >
        <DialogContent className="app-dialog">
          <DialogTitle>
            {goalModal === 'new' ? 'Give your goal a shape.' : 'Refine your next steps.'}
          </DialogTitle>
          <DialogDescription>
            A clear direction. A small action. A place to begin.
          </DialogDescription>
          {goalModal && (
            <GoalForm
              key={goalModal === 'new' ? 'new' : goalModal.id}
              goal={goalModal === 'new' ? undefined : goalModal}
              userId={user.id}
              onSaved={async () => {
                setGoalModal(null);
                await refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={checkin !== null}
        onOpenChange={(open) => {
          if (!open) setCheckin(null);
        }}
      >
        <DialogContent className="app-dialog">
          <DialogTitle>{checkin?.goal.title}</DialogTitle>
          <DialogDescription>
            Your check-in for {checkin?.day}. Every honest entry helps.
          </DialogDescription>
          {checkin && (
            <CheckinForm
              key={`${checkin.goal.id}-${checkin.day}`}
              goal={checkin.goal}
              day={checkin.day}
              entry={myEntries.find((e) => e.goal_id === checkin.goal.id && e.day === checkin.day)}
              note={
                notes.find(
                  (n) =>
                    n.checkin_id ===
                    myEntries.find((e) => e.goal_id === checkin.goal.id && e.day === checkin.day)
                      ?.id,
                )?.body || ''
              }
              onSaved={async (delta) => {
                const next = levelFor(xp + delta);
                setCheckin(null);
                if (delta > 0) {
                  if (sound) playSound(next > level);
                  if (next > level) setCelebrate(next);
                  else toast.success(`+${delta} XP. A little stronger.`);
                } else toast.success('Your check-in is saved.');
                await refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={celebrate !== null}
        onOpenChange={(open) => {
          if (!open) setCelebrate(null);
        }}
      >
        <DialogContent className="app-dialog celebration">
          <DialogTitle>A new level. Earned.</DialogTitle>
          <DialogDescription>Every small promise brought you here.</DialogDescription>
          <Emblem level={celebrate || 1} large />
          <p className="eyebrow">{rankFor(celebrate || 1)}</p>
          <div className="celebration-number">{String(celebrate || 1).padStart(2, '0')}</div>
          <button className="button primary" onClick={() => setCelebrate(null)}>
            Keep becoming
            <ArrowUpRight size={18} />
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="app-dialog">
          <DialogTitle>Your space.</DialogTitle>
          <DialogDescription>Make LevelUp feel like you.</DialogDescription>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setMutating(true);
              try {
                const { error } = await supabase
                  .from('profiles')
                  .update({
                    name: userName.trim() || 'Player',
                    avatar: userAvatar,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  })
                  .eq('id', user.id);
                if (error) throw error;
                await refresh();
                setDay(dayKey());
                toast.success('Profile saved.');
                setSettings(false);
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setMutating(false);
              }
            }}
          >
            <label>
              Display name
              <input
                required
                maxLength={60}
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </label>
            <fieldset>
              <legend>Your mark</legend>
              <div className="avatar-picker">
                {Object.entries(avatars).map(([key, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={key}
                    aria-pressed={userAvatar === key}
                    onClick={() => setUserAvatar(key)}
                  >
                    <Icon size={22} />
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="setting-row">
              <div>
                <strong>A little sound</strong>
                <p>Soft chimes for completions and new levels.</p>
              </div>
              <Switch
                aria-label="Enable sound"
                checked={sound}
                onCheckedChange={(v) => {
                  setSound(v);
                  localStorage.setItem('levelup-sound', String(v));
                  if (v) playSound();
                }}
              />
            </div>
            <div className="setting-row">
              <div>
                <strong>Less motion</strong>
                <p>Keep the celebrations quiet.</p>
              </div>
              <Switch
                aria-label="Reduce motion"
                checked={reduced}
                onCheckedChange={(v) => {
                  setReduced(v);
                  localStorage.setItem('levelup-motion', String(v));
                }}
              />
            </div>
            <p className="muted text-small">
              Saving uses this device’s timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
              .
            </p>
            <button className="button primary" disabled={mutating}>
              Save preferences
              <Check size={18} />
            </button>
            <button
              type="button"
              className="text-button muted"
              onClick={async () => {
                const { error } = await supabase.auth.signOut();
                if (error) toast.error(error.message);
                else setSettings(false);
              }}
            >
              <LogOut size={17} />
              Sign out
            </button>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!open && !mutating) setConfirm(null);
        }}
      >
        <AlertDialogContent className="app-dialog">
          <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutating}>Keep as is</AlertDialogCancel>
            <AlertDialogAction
              className="button primary"
              disabled={mutating}
              onClick={async (e) => {
                e.preventDefault();
                setMutating(true);
                try {
                  await confirm?.run();
                  setConfirm(null);
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setMutating(false);
                }
              }}
            >
              {mutating ? 'Saving…' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
