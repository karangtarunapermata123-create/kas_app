import { supabase } from '@/lib/supabase/client';
import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { safeAuthInit } from './auth-utils';

type Role = 'super_admin' | 'admin' | 'member';

type AdminContextValue = {
  ready: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  role: Role | null;
  session: Session | null;
  namaLengkap: string | null;
  setNamaLengkap: (nama: string) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

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
          if (error) {
            console.log('Visibility change session error:', error.message);
            // Clear invalid session
            setSession(null);
            setRole(null);
            setNamaLengkap(null);
            return;
          }
          
          if (!data.session) {
            // No session available
            setSession(null);
            setRole(null);
            setNamaLengkap(null);
            return;
          }
          
          const { role: r, namaLengkap: nama } = await fetchProfile(data.session.user.id);
          setRole(r);
          setNamaLengkap(nama);
        } catch (err) {
          console.log('Visibility change error (ignored):', err);
          // Ignore network errors during visibility change
        }
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    const handleOnline = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.log('Online session error:', error.message);
          return;
        }
        
        if (data.session) {
          const { role: r, namaLengkap: nama } = await fetchProfile(data.session.user.id);
          setRole(r);
          setNamaLengkap(nama);
        }
      } catch (err) {
        console.log('Online error (ignored):', err);
        // Ignore network errors
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
        // Use safe auth initialization
        const { session, error } = await safeAuthInit();
        
        if (error) {
          console.log('Auth initialization failed:', error);
          setSession(null);
          setRole(null);
          setNamaLengkap(null);
          setReady(true);
          return;
        }

        if (blockAuthEventsRef.current) {
          setSession(null);
          setRole(null);
          setNamaLengkap(null);
          setReady(true);
          return;
        }

        setSession(session);
        if (session?.user) {
          try {
            const { role: r, namaLengkap: nama } = await fetchProfile(session.user.id);
            setRole(r);
            setNamaLengkap(nama);
          } catch (profileError) {
            console.log('Profile fetch error:', profileError);
            // Continue without profile data
            setRole('member');
            setNamaLengkap(null);
          }
        } else {
          setRole(null);
          setNamaLengkap(null);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        // Clear session on any error
        setSession(null);
        setRole(null);
        setNamaLengkap(null);
      } finally {
        // Always set ready to prevent infinite loading
        setReady(true);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, !!session);
      
      if (blockAuthEventsRef.current) {
        setSession(null);
        setRole(null);
        setNamaLengkap(null);
        if (session) {
          try {
            await supabase.auth.signOut();
          } catch (e) {
            console.log('Sign out error in blocked state:', e);
          }
        }
        return;
      }
      
      // Handle token refresh failures and sign out
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.log('Token refresh failed, clearing session');
        setSession(null);
        setRole(null);
        setNamaLengkap(null);
        return;
      }
      
      if (event === 'SIGNED_OUT') {
        console.log('User signed out');
        setSession(null);
        setRole(null);
        setNamaLengkap(null);
        return;
      }
      
      // Handle sign in and token refresh success
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(session);
        if (session?.user) {
          try {
            const { role: r, namaLengkap: nama } = await fetchProfile(session.user.id);
            setRole(r);
            setNamaLengkap(nama);
          } catch (profileError) {
            console.log('Profile fetch error in auth change:', profileError);
            setRole('member');
            setNamaLengkap(null);
          }
        } else {
          setRole(null);
          setNamaLengkap(null);
        }
        return;
      }
      
      // Handle other events
      setSession(session);
      if (session?.user) {
        try {
          const { role: r, namaLengkap: nama } = await fetchProfile(session.user.id);
          setRole(r);
          setNamaLengkap(nama);
        } catch (profileError) {
          console.log('Profile fetch error:', profileError);
          setRole('member');
          setNamaLengkap(null);
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

  const isAdmin = role === 'admin' || role === 'super_admin';
  const isSuperAdmin = role === 'super_admin';

  const value = useMemo<AdminContextValue>(
    () => ({ ready, isAdmin, isSuperAdmin, role, session, namaLengkap, setNamaLengkap, signIn, signOut }),
    [ready, isAdmin, isSuperAdmin, role, session, namaLengkap, signIn, signOut],
  );

  return <AdminContext.Provider key={authEpoch} value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
