import { supabase } from '@/lib/supabase/client';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AbsensiEvent, Attendance, EventSession } from './types';

type AbsensiContextValue = {
  ready: boolean;
  events: AbsensiEvent[];
  sessions: EventSession[];
  attendances: Attendance[];
  lastAbsenAt: number;
  refreshData: () => Promise<void>;
  addEvent: (nama: string, deskripsi: string, tipe: 'SEKALI' | 'RUTIN', periodType?: 'WEEKLY' | 'MONTHLY') => Promise<AbsensiEvent>;
  renameEvent: (id: string, nama: string) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  addSession: (eventId: string, label: string, tanggal: string) => Promise<EventSession>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, label: string) => Promise<void>;
  absen: (eventId: string, sessionId: string, userId: string, namaUser: string) => Promise<void>;
  removeAbsen: (sessionId: string, userId: string) => Promise<void>;
  getSessionsByEvent: (eventId: string) => EventSession[];
  getAttendancesBySession: (sessionId: string) => Attendance[];
  hasAbsen: (sessionId: string, userId: string) => boolean;
};

const AbsensiContext = createContext<AbsensiContextValue | null>(null);

function makeId() {
  return `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function rowToEvent(row: any): AbsensiEvent {
  return {
    id: String(row.id),
    nama: row.nama,
    deskripsi: row.deskripsi ?? '',
    tipe: row.tipe ?? 'SEKALI',
    periodType: row.period_type ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToSession(row: any): EventSession {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    label: row.label,
    tanggal: row.tanggal,
    createdAt: row.created_at,
  };
}

function rowToAttendance(row: any): Attendance {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    sessionId: String(row.session_id),
    userId: String(row.user_id),
    namaUser: row.nama_user,
    waktuAbsen: row.waktu_absen,
  };
}

export function AbsensiProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [events, setEvents] = useState<AbsensiEvent[]>([]);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [lastAbsenAt, setLastAbsenAt] = useState(0);
  const stateRef = useRef({ attendances, sessions });
  stateRef.current = { attendances, sessions };

  const refreshData = useCallback(async () => {
    try {
      const [evRes, sesRes, attRes] = await Promise.all([
        supabase.from('events').select('*').order('created_at', { ascending: false }),
        supabase.from('event_sessions').select('*').order('tanggal', { ascending: false }),
        supabase.from('attendances').select('*'),
      ]);
      setEvents((evRes.data ?? []).map(rowToEvent));
      setSessions((sesRes.data ?? []).map(rowToSession));
      setAttendances((attRes.data ?? []).map(rowToAttendance));
    } catch (e) {
      console.error('refreshData error:', e);
    }
  }, []);

  const setupRealtime = useCallback(() => {
    const evSub = supabase.channel('events-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) => {
        setEvents(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(e => e.id !== (payload.old as any).id);
          const updated = rowToEvent(payload.new);
          const exists = prev.some(e => e.id === updated.id);
          return exists ? prev.map(e => e.id === updated.id ? updated : e) : [updated, ...prev];
        });
      }).subscribe();

    const sesSub = supabase.channel('sessions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_sessions' }, (payload) => {
        setSessions(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(s => s.id !== (payload.old as any).id);
          const updated = rowToSession(payload.new);
          const exists = prev.some(s => s.id === updated.id);
          return exists ? prev.map(s => s.id === updated.id ? updated : s) : [updated, ...prev];
        });
      }).subscribe();

    const attSub = supabase.channel('attendances-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendances' }, (payload) => {
        setAttendances(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(a => a.id !== (payload.old as any).id);
          const updated = rowToAttendance(payload.new);
          const exists = prev.some(a => a.id === updated.id);
          return exists ? prev : [...prev, updated];
        });
      }).subscribe();

    return { evSub, sesSub, attSub };
  }, []);

  // Refresh data saat tab aktif kembali
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisible = async () => {
      if (document.visibilityState === 'visible') {
        await refreshData();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshData]);

  useEffect(() => {
    let mounted = true;
    let realtimeCleanup: (() => void) | null = null;

    (async () => {
      try {
        await refreshData();
      } catch (e) {
        console.error('AbsensiProvider load error:', e);
      } finally {
        if (mounted) setReady(true);
      }

      const subs = setupRealtime();
      realtimeCleanup = () => {
        subs.evSub.unsubscribe();
        subs.sesSub.unsubscribe();
        subs.attSub.unsubscribe();
      };
    })();

    const handleOnline = async () => {
      if (mounted) {
        await refreshData();
        if (realtimeCleanup) realtimeCleanup();
        const subs = setupRealtime();
        realtimeCleanup = () => {
          subs.evSub.unsubscribe();
          subs.sesSub.unsubscribe();
          subs.attSub.unsubscribe();
        };
      }
    };

    if (typeof document !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    return () => {
      mounted = false;
      if (realtimeCleanup) realtimeCleanup();
      if (typeof document !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
    };
  }, [refreshData, setupRealtime]);

  const addEvent = useCallback(async (nama: string, deskripsi: string, tipe: 'SEKALI' | 'RUTIN', periodType?: 'WEEKLY' | 'MONTHLY'): Promise<AbsensiEvent> => {
    const { data: { user } } = await supabase.auth.getUser();
    const now = Date.now();
    const ev: AbsensiEvent = {
      id: makeId(), nama: nama.trim(), deskripsi: deskripsi.trim(),
      tipe, periodType, createdBy: user?.id ?? '', createdAt: now, updatedAt: now,
    };
    const { error } = await supabase.from('events').insert({
      id: ev.id, nama: ev.nama, deskripsi: ev.deskripsi, tipe: ev.tipe,
      period_type: ev.periodType ?? null, created_by: ev.createdBy,
      created_at: ev.createdAt, updated_at: ev.updatedAt,
    });
    if (error) { console.error('addEvent error:', JSON.stringify(error)); throw new Error(error.message); }
    setEvents(prev => [ev, ...prev]);
    return ev;
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    // Hapus dari DB dulu
    const attRes = await supabase.from('attendances').delete().eq('event_id', id);
    if (attRes.error) throw new Error(attRes.error.message);

    const sesRes = await supabase.from('event_sessions').delete().eq('event_id', id);
    if (sesRes.error) throw new Error(sesRes.error.message);

    const evRes = await supabase.from('events').delete().eq('id', id);
    if (evRes.error) throw new Error(evRes.error.message);
    // Fetch ulang dari DB untuk pastikan state sync
    await refreshData();
  }, [refreshData]);

  const renameEvent = useCallback(async (id: string, nama: string) => {
    const now = Date.now();
    const { error } = await supabase
      .from('events')
      .update({ nama: nama.trim(), updated_at: now })
      .eq('id', id);
    if (error) throw new Error(error.message);
    setEvents(prev => prev.map(e => e.id === id ? { ...e, nama: nama.trim(), updatedAt: now } : e));
  }, []);

  const addSession = useCallback(async (eventId: string, label: string, tanggal: string): Promise<EventSession> => {
    const now = Date.now();
    const ses: EventSession = { id: makeId(), eventId, label: label.trim(), tanggal, createdAt: now };
    const { error } = await supabase.from('event_sessions').insert({
      id: ses.id, event_id: ses.eventId, label: ses.label, tanggal: ses.tanggal, created_at: ses.createdAt,
    });
    if (error) { console.error('addSession error:', JSON.stringify(error)); throw new Error(error.message); }
    setSessions(prev => [ses, ...prev]);
    return ses;
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    await supabase.from('attendances').delete().eq('session_id', id);
    await supabase.from('event_sessions').delete().eq('id', id);
    setSessions(prev => prev.filter(s => s.id !== id));
    setAttendances(prev => prev.filter(a => a.sessionId !== id));
  }, []);

  const renameSession = useCallback(async (id: string, label: string) => {
    const { error } = await supabase
      .from('event_sessions')
      .update({ label: label.trim() })
      .eq('id', id);
    if (error) throw new Error(error.message);
    setSessions(prev => prev.map(s => s.id === id ? { ...s, label: label.trim() } : s));
  }, []);

  const absen = useCallback(async (eventId: string, sessionId: string, userId: string, namaUser: string) => {
    const already = stateRef.current.attendances.some(a => a.sessionId === sessionId && a.userId === userId);
    if (already) throw new Error('Anda sudah absen di sesi ini.');
    const now = Date.now();
    const att: Attendance = { id: makeId(), eventId, sessionId, userId, namaUser, waktuAbsen: now };
    const { error } = await supabase.from('attendances').insert({
      id: att.id, event_id: att.eventId, session_id: att.sessionId,
      user_id: att.userId, nama_user: att.namaUser, waktu_absen: att.waktuAbsen,
    });
    if (error) {
      console.error('absen error:', JSON.stringify(error));
      throw new Error(error.message);
    }
    setAttendances(prev => [...prev, att]);
    setLastAbsenAt(Date.now());
  }, []);

  const removeAbsen = useCallback(async (sessionId: string, userId: string) => {
    const { error } = await supabase
      .from('attendances')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    setAttendances(prev => prev.filter(a => !(a.sessionId === sessionId && a.userId === userId)));
  }, []);

  const getSessionsByEvent = useCallback((eventId: string) =>
    stateRef.current.sessions.filter(s => s.eventId === eventId), []);

  const getAttendancesBySession = useCallback((sessionId: string) =>
    stateRef.current.attendances.filter(a => a.sessionId === sessionId), []);

  const hasAbsen = useCallback((sessionId: string, userId: string) =>
    stateRef.current.attendances.some(a => a.sessionId === sessionId && a.userId === userId), []);

  const value = useMemo<AbsensiContextValue>(() => ({
    ready, events, sessions, attendances, lastAbsenAt,
    refreshData,
    addEvent, renameEvent, deleteEvent, addSession, deleteSession, renameSession,
    absen, removeAbsen, getSessionsByEvent, getAttendancesBySession, hasAbsen,
  }), [ready, events, sessions, attendances, lastAbsenAt, refreshData, addEvent, renameEvent, deleteEvent, addSession, deleteSession, renameSession, absen, removeAbsen, getSessionsByEvent, getAttendancesBySession, hasAbsen]);

  return <AbsensiContext.Provider value={value}>{children}</AbsensiContext.Provider>;
}

export function useAbsensi() {
  const ctx = useContext(AbsensiContext);
  if (!ctx) throw new Error('useAbsensi must be used within AbsensiProvider');
  return ctx;
}
