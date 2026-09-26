'use client';
import { useEffect, useState } from 'react';
import {
  ChevronsUp,
  Flame,
  Target,
  TrendingUp,
  Users,
  Volume2,
  VolumeX,
  LogOut,
  LoaderCircle,
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
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { usePlayer } from '@/lib/use-player';
import { rememberInvite } from '@/lib/invitation';
import { levelFor, formatDay, type Goal } from '@/lib/model';
import { playSound } from '@/lib/sound';
import { useWebMCP } from '@/lib/use-webmcp';
import { AuthScreen } from './auth/auth-screen';
import { PlayerSetup } from './player-setup';
import { Insignia } from './insignia';
import { GoalForm } from './goal-form';
import { CheckinForm } from './checkin-form';
import { TodayScreen } from './screens/today';
import { GoalsScreen } from './screens/goals';
import { ProgressScreen } from './screens/progress';
import { PartnerScreen } from './screens/partner';
const navigation = [
  { id: 'today', name: 'Today', icon: Flame },
  { id: 'goals', name: 'Goals', icon: Target },
  { id: 'progress', name: 'Progress', icon: TrendingUp },
  { id: 'partner', name: 'Partner', icon: Users },
];
export default function LevelUp() {
  const { user, authReady, data, error, loading, refresh } = usePlayer();
  const [tab, setTab] = useState('today');
  const [pendingCode, setPendingCode] = useState('');
  const [sound, setSound] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [settings, setSettings] = useState(false);
  const [goalModal, setGoalModal] = useState<Goal | 'new' | null>(null);
  const [checkin, setCheckin] = useState<{ goal: Goal; day: string } | null>(null);
  const [celebration, setCelebration] = useState<{
    level: number;
    xp: number;
    bonus: number;
  } | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    run: () => Promise<void>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  useWebMCP(user?.id, data?.goals || [], () => setGoalModal('new'));
  useEffect(() => {
    setSettings(false);
    setGoalModal(null);
    setCheckin(null);
    setCelebration(null);
    setConfirm(null);
  }, [user?.id]);
  useEffect(() => {
    setSound(localStorage.getItem('levelup-sound') === 'true');
    setReduced(localStorage.getItem('levelup-motion') === 'true');
    setPendingCode(rememberInvite() || '');
    const url = new URL(window.location.href);
    url.searchParams.delete('invite');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reduced);
  }, [reduced]);
  const profile = data?.profiles.find((p) => p.id === user?.id);
  useEffect(() => {
    if (profile?.onboarding_completed_at && pendingCode) setTab('partner');
  }, [profile?.id, profile?.onboarding_completed_at, pendingCode]);
  function changeTab(value: string) {
    setTab(value);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  async function savedGoal() {
    await refresh();
    setGoalModal(null);
  }
  async function savedEntry() {
    const previous = data!;
    const next = await refresh();
    setCheckin(null);
    if (!next) return;
    const delta = next.total_xp - previous.total_xp;
    const bonus = Math.max(
      0,
      next.bonuses.filter((b) => b.user_id === user!.id).reduce((n, b) => n + b.xp, 0) -
        previous.bonuses.filter((b) => b.user_id === user!.id).reduce((n, b) => n + b.xp, 0),
    );
    if (delta > 0) {
      const level = levelFor(next.total_xp);
      const leveled = level > levelFor(previous.total_xp);
      if (sound) playSound(leveled);
      if (leveled) setCelebration({ level, xp: delta, bonus });
      else toast.success(`+${delta} XP${bonus ? ` · ${bonus} bonus` : ''}`);
    } else toast.success(delta < 0 ? `Progress corrected · ${delta} XP` : 'Progress saved');
  }
  function archive(goal: Goal, value: boolean) {
    setConfirm({
      title: value ? 'Archive goal?' : 'Start a new run?',
      description: value
        ? 'Earned XP stays. This run ends today.'
        : 'Previous history stays. Your streak starts fresh.',
      run: async () => {
        const { error } = await supabase.rpc('set_goal_archived', { gid: goal.id, archive: value });
        if (error) throw error;
        await refresh();
      },
    });
  }
  const toasts = <Toaster theme="dark" position="top-center" />;
  if (!authReady)
    return (
      <>
        <div className="loading-screen">
          <ChevronsUp />
          <p>LevelUp</p>
        </div>
        {toasts}
      </>
    );
  if (!user)
    return (
      <>
        <AuthScreen />
        {toasts}
      </>
    );
  if (!data || !profile)
    return (
      <>
        {toasts}
        <main className="callback-shell panel">
          {loading || !error ? (
            <>
              <LoaderCircle className="spin" />
              <p>Loading your player…</p>
            </>
          ) : (
            <>
              <h2>Unable to load</h2>
              <p className="form-error" role="alert">
                {error}
              </p>
              <small>For an upgrade, apply migration 002 first.</small>
              <button
                className="button primary"
                onClick={() => void refresh().catch((e) => toast.error(e.message))}
              >
                Retry
              </button>
            </>
          )}
          <button className="text-button" onClick={() => void supabase.auth.signOut()}>
            Sign out
          </button>
        </main>
      </>
    );
  if (!profile.onboarding_completed_at)
    return (
      <>
        {toasts}
        <main className="onboarding-shell">
          <a href="/" className="brand">
            <ChevronsUp />
            levelup
          </a>
          <section className="panel">
            <p className="eyebrow">PLAYER SETUP</p>
            <h1>Create your player</h1>
            <PlayerSetup
              profile={profile}
              initial
              onSaved={async () => {
                await refresh();
                if (pendingCode) setTab('partner');
              }}
            />
          </section>
        </main>
      </>
    );
  const mine = data.goals.filter((g) => g.user_id === user.id);
  const selectedEntry = checkin
    ? data.entries.find((e) => e.goal_id === checkin.goal.id && e.day === checkin.day)
    : undefined;
  const selectedPeriod = selectedEntry?.period_id
    ? data.periods.find((p) => p.id === selectedEntry.period_id)
    : checkin
      ? data.periods
          .filter(
            (p) =>
              p.goal_id === checkin.goal.id &&
              p.effective_on <= checkin.day &&
              p.ends_on >= checkin.day &&
              (!p.run_ends_on || p.run_ends_on >= checkin.day),
          )
          .sort((a, b) => b.effective_on.localeCompare(a.effective_on))[0]
      : null;
  const unread = data.reactions.filter(
    (r) => !r.seen && data.entries.some((e) => e.id === r.checkin_id && e.user_id === user.id),
  ).length;
  return (
    <div className="app app-v2">
      {toasts}
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <a className="brand" href="/">
          <ChevronsUp />
          levelup
        </a>
        <div className="topbar-right">
          <button
            className="icon-button"
            aria-label={sound ? 'Mute sound' : 'Enable sound'}
            onClick={() => {
              const next = !sound;
              setSound(next);
              localStorage.setItem('levelup-sound', String(next));
              if (next) playSound();
            }}
          >
            {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>
          <button className="avatar" aria-label="Player settings" onClick={() => setSettings(true)}>
            <Insignia mark={profile.avatar} size={28} />
          </button>
        </div>
      </header>
      <Tabs value={tab} onValueChange={changeTab} className="app-tabs">
        <TabsList className="bottom-nav" aria-label="Navigation">
          {navigation.map((n) => (
            <TabsTrigger value={n.id} key={n.id}>
              <n.icon size={20} />
              <span>{n.name}</span>
              {n.id === 'partner' && unread > 0 && (
                <span className="notification-dot" aria-label={`${unread} new reactions`} />
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        <main id="main" className="main-shell">
          <TabsContent value="today">
            <TodayScreen
              data={data}
              profile={profile}
              onLog={(goal, day) => setCheckin({ goal, day })}
              onCreate={() => setGoalModal('new')}
            />
          </TabsContent>
          <TabsContent value="goals">
            <GoalsScreen
              goals={mine}
              onEdit={setGoalModal}
              onCreate={() => setGoalModal('new')}
              onArchive={archive}
            />
          </TabsContent>
          <TabsContent value="progress">
            <ProgressScreen
              data={data}
              userId={user.id}
              onLog={(goal, day) => setCheckin({ goal, day })}
            />
          </TabsContent>
          <TabsContent value="partner">
            <PartnerScreen
              data={data}
              userId={user.id}
              initialCode={pendingCode}
              onAccepted={() => setPendingCode('')}
              refresh={refresh}
              onDisconnect={() =>
                setConfirm({
                  title: 'Disconnect partner?',
                  description:
                    'Shared goals become inaccessible to each other. Your history stays.',
                  run: async () => {
                    const { error } = await supabase.rpc('disconnect_partner');
                    if (error) throw error;
                    setPendingCode('');
                    await refresh();
                  },
                })
              }
            />
          </TabsContent>
        </main>
      </Tabs>
      <Dialog
        open={goalModal !== null}
        onOpenChange={(open) => {
          if (!open) setGoalModal(null);
        }}
      >
        <DialogContent className="app-dialog">
          <DialogTitle>{goalModal === 'new' ? 'New goal' : 'Edit goal'}</DialogTitle>
          <DialogDescription>Set a target. Choose your days as you go.</DialogDescription>
          {goalModal && (
            <GoalForm
              key={goalModal === 'new' ? 'new' : goalModal.id}
              goal={goalModal === 'new' ? undefined : goalModal}
              onSaved={savedGoal}
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
            {checkin ? `${formatDay(checkin.day)} · ${checkin.goal.timezone}` : 'Log progress'}
          </DialogDescription>
          {checkin && (
            <CheckinForm
              key={`${checkin.goal.id}-${checkin.day}`}
              goal={checkin.goal}
              day={checkin.day}
              entry={selectedEntry}
              period={selectedEntry && !selectedEntry.period_id ? null : selectedPeriod}
              note={data.notes.find((n) => n.checkin_id === selectedEntry?.id)?.body || ''}
              onSaved={savedEntry}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="app-dialog">
          <DialogTitle>Your player</DialogTitle>
          <DialogDescription className="sr-only">Profile and preferences</DialogDescription>
          <PlayerSetup
            profile={profile}
            onSaved={async () => {
              await refresh();
              setSettings(false);
              toast.success('Profile saved');
            }}
          />
          <div className="setting-row">
            <strong>Sound</strong>
            <Switch
              aria-label="Sound"
              checked={sound}
              onCheckedChange={(v) => {
                setSound(v);
                localStorage.setItem('levelup-sound', String(v));
                if (v) playSound();
              }}
            />
          </div>
          <div className="setting-row">
            <strong>Reduce motion</strong>
            <Switch
              aria-label="Reduce motion"
              checked={reduced}
              onCheckedChange={(v) => {
                setReduced(v);
                localStorage.setItem('levelup-motion', String(v));
              }}
            />
          </div>
          <button
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
        </DialogContent>
      </Dialog>
      <Dialog
        open={celebration !== null}
        onOpenChange={(open) => {
          if (!open) setCelebration(null);
        }}
      >
        <DialogContent className="app-dialog celebration">
          <DialogTitle>Level up</DialogTitle>
          <DialogDescription>
            +{celebration?.xp} XP
            {celebration?.bonus ? ` · includes ${celebration.bonus} bonus` : ''}
          </DialogDescription>
          <div className="celebration-mark">
            <Insignia mark={profile.avatar} size={104} />
          </div>
          <div className="celebration-number">{celebration?.level}</div>
          <button className="button primary" onClick={() => setCelebration(null)}>
            Continue
          </button>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirm(null);
        }}
      >
        <AlertDialogContent className="app-dialog">
          <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="button primary"
              disabled={busy}
              onClick={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await confirm?.run();
                  setConfirm(null);
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Saving…' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
