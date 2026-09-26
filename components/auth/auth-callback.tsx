'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authRedirect, rememberInvite } from '@/lib/invitation';
import { PasswordField } from './password-field';
export function AuthCallback({ recovery = false }: { recovery?: boolean }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  useEffect(() => {
    rememberInvite();
    const params = new URLSearchParams(window.location.hash.slice(1));
    const problem =
      params.get('error_description') ||
      new URLSearchParams(window.location.search).get('error_description');
    if (problem) {
      setError('This link has expired or was already used. Request a new one.');
      return;
    }
    let live = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!live) return;
      if (error || !data.session) {
        setError('This link has expired or was already used. Request a new one.');
        return;
      }
      if (recovery) setReady(true);
      else window.location.replace(authRedirect('/'));
    });
    return () => {
      live = false;
    };
  }, [recovery]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      window.location.replace(authRedirect('/'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = recovery
        ? await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: authRedirect('/auth/recovery'),
          })
        : await supabase.auth.resend({
            type: 'signup',
            email,
            options: { emailRedirectTo: authRedirect('/auth/confirm') },
          });
      if (result.error) throw result.error;
      setMessage('Check your email for a new link.');
      setCooldown(true);
      setTimeout(() => setCooldown(false), 60000);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="callback-shell panel">
      <h1>{recovery ? 'New password' : 'Confirm email'}</h1>
      {ready && recovery ? (
        <form className="form-stack" onSubmit={save}>
          <PasswordField value={password} onChange={setPassword} newPassword label="New password" />
          <button className="button primary" disabled={busy}>
            Save password
          </button>
        </form>
      ) : (
        !error && <p role="status">Confirming…</p>
      )}
      {error && (
        <>
          <p role="alert" className="form-error">
            {error}
          </p>
          {!ready && (
            <form className="form-stack" onSubmit={resend}>
              <label>
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <button className="button primary" disabled={busy || cooldown}>
                {cooldown ? 'Please wait a minute' : 'Send a new link'}
              </button>
            </form>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
      <a className="text-button" href="/">
        Back to LevelUp
      </a>
    </main>
  );
}
