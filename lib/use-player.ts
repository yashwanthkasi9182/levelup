'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Dashboard } from './model';
export function usePlayer() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (live) {
        setUser(data.session?.user || null);
        setAuthReady(true);
        if (error) setError(error.message);
      }
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_e, s) => {
      if (live) {
        setUser(s?.user || null);
        setAuthReady(true);
      }
    });
    return () => {
      live = false;
      subscription.subscription.unsubscribe();
    };
  }, []);
  const refresh = useCallback(async () => {
    if (!user) return null;
    const version = ++generation.current;
    const { data, error } = await supabase.rpc('player_dashboard');
    if (error) throw error;
    if (version === generation.current) {
      setData(data as Dashboard);
      setError('');
    }
    return data as Dashboard;
  }, [user?.id]);
  useEffect(() => {
    generation.current++;
    setData(null);
    if (!user) return;
    let live = true;
    setLoading(true);
    refresh()
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
      generation.current++;
    };
  }, [user?.id, refresh]);
  useEffect(() => {
    if (!user) return;
    const poll = () => {
      if (document.visibilityState === 'visible') void refresh().catch(() => {});
    };
    const id = setInterval(poll, 30000);
    window.addEventListener('focus', poll);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', poll);
    };
  }, [user?.id, refresh]);
  return { user, authReady, data, error, loading, refresh };
}
