import { supabase } from '@/lib/supabase/client';
import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type Role = 'admin' | 'member';

type AdminContextValue = {
  ready: boolean;
  isAdmin: boolean;
  role: Role | null;
  session: Session | null;
  namaLengkap: string | null;
  setNamaLengkap: (nama: string) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

async function fetchRole(userId: string): Promise<Role> {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  return (data?.role as Role) ?? 'member';
}

async function fetchProfile(userId: string): Promise<{ role: Role; namaLengkap: string | null }> {
  const { data } = await supabase
    .from('profiles')
    .select('role, nama_lengkap')
    .eq('id', userId)
    .single();
  return {
    role: (data?.role as Role) ?? 'member',
    namaLengkap: data?.nama_lengkap ?? null,
  };
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [namaLengkap, setNamaLengkap] = useState<string | null>(null);
  const [authEpoch, setAuthEpoch] = useState(0);
  const blockAuthEventsRef = useRef(false);

  // Auto refresh session saat tab aktif kembali (web)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisible = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error || !data.session) {
            // Tidak ada session valid — pastikan state bersih, jangan refresh
            setSession(null);
            setRole(null);
            setNamaLengkap(null);
            return;
          }
          const { role: r, namaLengkap: nama } = await fetchProfile(data.session.user.id);
          setRole(r);
          setNamaLengkap(nama);
        } catch {
          // Abaikan error jaringan saat visibility change
        }
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    const handleOnline = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const { role: r, namaLengkap: nama } = await fetchProfile(data.session.user.id);
          setRole(r);
          setNamaLengkap(nama);
        }
      } catch {
        // Abaikan error jaringan
      }
    };
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          // Invalid/expired refresh token — clear session dan lanjut
          await supabase.auth.signOut();
          setSession(null);
          setRole(null);
          return;
        }

        if (blockAuthEventsRef.current) {
          setSession(null);
          setRole(null);
          return;
        }

        setSession(data.session);
        if (data.session?.user) {
          const { role: r, namaLengkap: nama } = await fetchProfile(data.session.user.id);
          setRole(r);
          setNamaLengkap(nama);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        // Apapun yang terjadi (error jaringan, dll), kita set ready agar app tidak loading selamanya
        setReady(true);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (blockAuthEventsRef.current) {
        setSession(null);
        setRole(null);
        if (session) void supabase.auth.signOut();
        return;
      }
      // Token refresh gagal atau user sign out — clear semua state
      if ((event === 'TOKEN_REFRESHED' && !session) || event === 'SIGNED_OUT') {
        setSession(null);
        setRole(null);
        setNamaLengkap(null);
        return;
      }
      setSession(session);
      if (session?.user) {
        try {
          const { role: r, namaLengkap: nama } = await fetchProfile(session.user.id);
          setRole(r);
          setNamaLengkap(nama);
        } catch {
          // Abaikan error fetch profile
        }
      } else {
        setRole(null);
        setNamaLengkap(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    blockAuthEventsRef.current = false;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    blockAuthEventsRef.current = true;
    setSession(null);
    setRole(null);
    setNamaLengkap(null);
    setAuthEpoch((v) => v + 1);
    void supabase.auth.signOut();
  }, []);

  const isAdmin = role === 'admin';

  const value = useMemo<AdminContextValue>(
    () => ({ ready, isAdmin, role, session, namaLengkap, setNamaLengkap, signIn, signOut }),
    [ready, isAdmin, role, session, namaLengkap, signIn, signOut],
  );

  return <AdminContext.Provider key={authEpoch} value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
