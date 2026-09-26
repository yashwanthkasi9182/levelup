'use client';
import { useState } from 'react';
import { ArrowRight, ChevronsUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authRedirect } from '@/lib/invitation';
import { PasswordField } from './password-field';
import { Insignia } from '../insignia';
export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  function switchMode(next: typeof mode) {
    setMode(next);
    setError('');
    setMessage('');
    setPassword('');
    setNeedsConfirmation(false);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          setNeedsConfirmation(error.code === 'email_not_confirmed');
          throw error;
        }
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: authRedirect('/auth/confirm'),
            data: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
          },
        });
        if (error) throw error;
        setMessage(data.session ? 'Account created.' : 'Check your email to confirm your account.');
        setPassword('');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: authRedirect('/auth/recovery'),
        });
        if (error) throw error;
        setMessage('If this account exists, a reset link is on its way.');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: authRedirect('/auth/confirm') },
      });
      if (error) throw error;
      setMessage('A new confirmation link is on its way.');
      setCooldown(true);
      setTimeout(() => setCooldown(false), 60000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <section className="auth-art">
        <a className="brand" href="/">
          <ChevronsUp />
          levelup
        </a>
        <div className="auth-art-body">
          <p className="eyebrow">YOUR NEXT LEVEL</p>
          <h1>
            Small actions.
            <br />
            Real progress.
          </h1>
          <div className="identity-showcase">
            <Insignia mark="apex" size={150} />
          </div>
        </div>
        <div className="auth-foot">
          <span>YOUR PACE. YOUR PROGRESS.</span>
          <span>01 — ∞</span>
        </div>
      </section>
      <section className="auth-form">
        <h2>
          {mode === 'login'
            ? 'Welcome back.'
            : mode === 'signup'
              ? 'Start your journey.'
              : 'Reset password.'}
        </h2>
        <form className="form-stack" onSubmit={submit}>
          <label>
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {mode !== 'forgot' && (
            <PasswordField
              value={password}
              onChange={setPassword}
              newPassword={mode === 'signup'}
            />
          )}
          <p role="alert" className="form-error">
            {error}
          </p>
          {message && (
            <p role="status" className="form-success">
              {message}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy
              ? 'Please wait…'
              : mode === 'login'
                ? 'Log in'
                : mode === 'signup'
                  ? 'Create account'
                  : 'Send reset link'}
            <ArrowRight size={18} />
          </button>
        </form>
        {((mode === 'signup' && message) || needsConfirmation) && (
          <button className="text-button" disabled={busy || cooldown} onClick={resend}>
            {cooldown ? 'Try again in a minute' : 'Resend confirmation'}
          </button>
        )}
        <div className="auth-links">
          {mode === 'login' ? (
            <>
              <button className="text-button" onClick={() => switchMode('signup')}>
                Create account
              </button>
              <button className="text-button muted" onClick={() => switchMode('forgot')}>
                Forgot password?
              </button>
            </>
          ) : (
            <button className="text-button" onClick={() => switchMode('login')}>
              Back to log in
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
