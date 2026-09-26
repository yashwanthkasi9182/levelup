'use client';
import { useState } from 'react';
import { Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile, Mark } from '@/lib/model';
import { marks, Insignia } from './insignia';
export function PlayerSetup({
  profile,
  onSaved,
  initial = false,
}: {
  profile: Profile;
  onSaved: () => Promise<void>;
  initial?: boolean;
}) {
  const [name, setName] = useState(initial && profile.name === 'Player' ? '' : profile.name);
  const [mark, setMark] = useState<Mark>(profile.avatar || 'apex');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { error } = await supabase.rpc('save_player', {
        player_name: name,
        mark,
        zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (error) throw error;
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form-stack" onSubmit={save}>
      <div className="player-preview">
        <Insignia mark={mark} size={76} />
      </div>
      <label>
        Player name
        <input
          autoComplete="nickname"
          required
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
      </label>
      <fieldset>
        <legend>Your insignia</legend>
        <div className="mark-grid">
          {marks.map((m) => (
            <button key={m} type="button" aria-pressed={mark === m} onClick={() => setMark(m)}>
              <Insignia mark={m} size={38} />
              <span>{m}</span>
              {mark === m && <Check size={13} />}
            </button>
          ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="button primary" disabled={busy || !name.trim()}>
        {busy ? 'Saving…' : initial ? 'Enter LevelUp' : 'Save profile'}
      </button>
      {initial && (
        <button
          type="button"
          className="text-button muted"
          onClick={() => void supabase.auth.signOut()}
        >
          Sign out
        </button>
      )}
    </form>
  );
}
