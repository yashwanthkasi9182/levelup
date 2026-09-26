'use client';
import { useState } from 'react';
import { Copy, Heart, CheckCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { clearInvite, validInvite } from '@/lib/invitation';
import type { Dashboard, Entry } from '@/lib/model';
import { Insignia } from '../insignia';
import { GoalProgress, Streaks, Empty } from './shared';
export function PartnerScreen({
  data,
  userId,
  initialCode,
  refresh,
  onDisconnect,
  onAccepted,
}: {
  data: Dashboard;
  userId: string;
  initialCode: string;
  refresh: () => Promise<Dashboard | null>;
  onDisconnect: () => void;
  onAccepted: () => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const partner = data.profiles.find((p) => p.id === data.partner_id);
  const shared = data.goals.filter((g) => g.user_id === data.partner_id);
  const entries = data.entries.filter((e) => e.user_id === data.partner_id);
  const unread = data.reactions.filter(
    (r) => !r.seen && data.entries.some((e) => e.id === r.checkin_id && e.user_id === userId),
  );
  async function create() {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('create_invite');
      if (error) throw error;
      setLink(`${window.location.origin}/?invite=${data}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function accept() {
    setBusy(true);
    try {
      let value = code.trim();
      if (value.includes('://')) value = new URL(value).searchParams.get('invite') || '';
      if (!validInvite(value)) throw new Error('Paste a valid invitation link.');
      const { error } = await supabase.rpc('accept_invite', { code: value });
      if (error) throw error;
      clearInvite();
      setCode('');
      onAccepted();
      await refresh();
      toast.success('Partner connected');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function react(e: Entry, emoji: string) {
    setBusy(true);
    try {
      const current = data.reactions.find((r) => r.checkin_id === e.id && r.user_id === userId);
      const { error } = await supabase.rpc('react_to', {
        cid: e.id,
        reaction: current?.emoji === emoji ? null : emoji,
      });
      if (error) throw error;
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="screen">
      <div className="v2-heading">
        <h1>Partner</h1>
        <button
          className="icon-button"
          aria-label="Refresh partner"
          onClick={() => void refresh().catch((e) => toast.error(e.message))}
        >
          <RefreshCw size={18} />
        </button>
      </div>
      {unread.length > 0 && (
        <div className="reaction-inbox">
          <div>
            <strong>{unread.map((r) => r.emoji).join(' ')}</strong>
            <p>{unread.length} new reactions</p>
          </div>
          <button
            className="icon-button"
            aria-label="Mark reactions read"
            onClick={async () => {
              const { error } = await supabase.rpc('mark_reactions_seen');
              if (error) toast.error(error.message);
              else await refresh();
            }}
          >
            <CheckCheck size={20} />
          </button>
        </div>
      )}
      {!partner ? (
        <div className="partner-onboarding">
          <section className="panel partner-invite">
            <div className="partner-symbol">
              <span>
                <Heart size={26} />
              </span>
            </div>
            <h2>Grow together.</h2>
            <p>Invite one person. Share the goals you choose.</p>
            <button className="button primary" onClick={create} disabled={busy}>
              {link ? 'Replace invitation' : 'Create invitation'}
            </button>
            {link && (
              <div className="invite-link">
                <label>
                  Link · expires in 7 days
                  <input readOnly value={link} onFocus={(e) => e.target.select()} />
                </label>
                <button
                  className="text-button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(link);
                      toast.success('Link copied');
                    } catch {
                      toast.error('Select and copy the link manually.');
                    }
                  }}
                >
                  <Copy size={16} />
                  Copy
                </button>
              </div>
            )}
          </section>
          <section className="panel accept-panel">
            <h3>Have an invitation?</h3>
            <label>
              Link or code
              <input value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <button className="button primary" disabled={busy || !code.trim()} onClick={accept}>
              Accept invitation
            </button>
          </section>
        </div>
      ) : (
        <>
          <section className="partner-banner">
            <div className="partner-avatar">
              <Insignia mark={partner.avatar} size={40} />
            </div>
            <div>
              <p className="eyebrow">YOUR PARTNER</p>
              <h2>{partner.name}</h2>
            </div>
            <button className="text-button muted" onClick={onDisconnect}>
              Disconnect
            </button>
          </section>
          <div className="section-heading">
            <h2>Shared goals</h2>
          </div>
          <div className="partner-goals">
            {shared
              .filter((g) => !g.archived)
              .map((g) => (
                <article className="panel" key={g.id}>
                  <h3>{g.title}</h3>
                  <GoalProgress goal={g} />
                  <Streaks goal={g} />
                </article>
              ))}
          </div>
          <div className="section-heading">
            <h2>Recent wins</h2>
          </div>
          <div className="bonus-list">
            {data.bonuses
              .filter((b) => b.user_id === partner.id)
              .slice(0, 5)
              .map((b) => (
                <div className="bonus-row" key={b.id}>
                  <span className="bonus-icon">
                    <Heart size={17} />
                  </span>
                  <div>
                    <strong>{shared.find((g) => g.id === b.goal_id)?.title}</strong>
                    <small>
                      {b.kind === 'week'
                        ? 'Weekly target'
                        : b.kind === 'month'
                          ? 'Monthly target'
                          : 'Monthly consistency'}
                    </small>
                  </div>
                  <b>+{b.xp}</b>
                </div>
              ))}
          </div>
          <div className="section-heading">
            <h2>Check-ins</h2>
          </div>
          <div className="partner-feed">
            {entries.slice(0, 30).map((e) => {
              const g = shared.find((g) => g.id === e.goal_id);
              if (!g) return null;
              const p = data.periods.find((p) => p.id === e.period_id);
              const reaction = data.reactions.find(
                (r) => r.checkin_id === e.id && r.user_id === userId,
              );
              return (
                <article className="feed-entry" key={e.id}>
                  <div className="row spread">
                    <strong>{g.title}</strong>
                    <small>{e.day}</small>
                  </div>
                  <p className="feed-status">
                    {p?.measure === 'quantity'
                      ? `${e.quantity} ${p.unit}`
                      : e.status === 'full'
                        ? 'Full action'
                        : e.status === 'small'
                          ? 'Smaller action'
                          : 'Skipped'}
                  </p>
                  {e.shared_note && <blockquote>{e.shared_note}</blockquote>}
                  <div className="reaction-buttons">
                    {['❤️', '🔥', '👏', '💪'].map((emoji) => (
                      <button
                        key={emoji}
                        aria-label={`React ${emoji}`}
                        aria-pressed={reaction?.emoji === emoji}
                        disabled={busy}
                        onClick={() => void react(e, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
          {!entries.length && <Empty title="Their next check-in will appear here" />}
        </>
      )}
    </section>
  );
}
