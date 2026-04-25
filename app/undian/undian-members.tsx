import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Profile = { id: string; nama_lengkap: string | null; email: string | null };

export default function UndianMembersScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const mutedColor = useThemeColor({}, 'muted');
  const successColor = (useThemeColor({}, 'success') as string | undefined) ?? '#22c55e';

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionLabel, setSessionLabel] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Get session info
        const sessionRes = await supabase
          .from('undian_sessions')
          .select('label')
          .eq('id', sessionId)
          .single();
        
        if (sessionRes.data) {
          setSessionLabel(sessionRes.data.label);
        }

        const [profileRes, memberRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, nama_lengkap, email')
            .order('nama_lengkap', { ascending: true }),
          supabase
            .from('undian_members')
            .select('user_id')
            .eq('session_id', sessionId),
        ]);
        if (cancelled) return;
        if (profileRes.data) setProfiles(profileRes.data as Profile[]);
        if (memberRes.data) {
          setSelected(new Set(memberRes.data.map((r: any) => r.user_id as string)));
        }
      } catch (e) {
        console.error('undian-members load error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Real-time subscription for member changes
    const membersChannel = supabase
      .channel(`undian_members_edit_${sessionId}`)
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'undian_members',
          filter: `session_id=eq.${sessionId}`
        },
        async () => {
          if (cancelled) return;
          try {
            const memberRes = await supabase
              .from('undian_members')
              .select('user_id')
              .eq('session_id', sessionId);
            
            if (memberRes.data) {
              setSelected(new Set(memberRes.data.map((r: any) => r.user_id as string)));
            }
          } catch (e) {
            console.error('Real-time member update error:', e);
          }
        }
      )
      .subscribe();

    return () => { 
      cancelled = true;
      supabase.removeChannel(membersChannel);
    };
  }, [sessionId]);

  const toggleMember = useCallback((userId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setSelected(new Set(profiles.map(p => p.id))), [profiles]);
  const clearAll = useCallback(() => setSelected(new Set()), []);

  const onSave = useCallback(async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('undian_members')
        .select('user_id')
        .eq('session_id', sessionId);
      
      const existingIds = new Set((existing ?? []).map((r: any) => r.user_id as string));

      const toDelete = Array.from(existingIds).filter(id => !selected.has(id));
      const toInsert = Array.from(selected).filter(id => !existingIds.has(id));

      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('undian_members')
          .delete()
          .eq('session_id', sessionId)
          .in('user_id', toDelete);
        if (error) throw new Error(error.message);
      }
      
      if (toInsert.length > 0) {
        const insertData = toInsert.map(user_id => ({
          id: `member_${sessionId}_${user_id}_${Date.now()}`,
          session_id: sessionId,
          user_id,
          created_at: Date.now(),
        }));
        const { error } = await supabase.from('undian_members').insert(insertData);
        if (error) throw new Error(error.message);
      }

      router.back();
    } catch (e: any) {
      Alert.alert('Gagal', e.message ?? 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  }, [selected, sessionId]);

  const allSelected = profiles.length > 0 && selected.size === profiles.length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={tintColor} />
          <ThemedText style={{ color: tintColor, fontSize: 16 }}>Kembali</ThemedText>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>Edit Anggota</ThemedText>
          <ThemedText type="muted" style={{ fontSize: 12 }} numberOfLines={1}>{sessionLabel}</ThemedText>
        </View>
        <Pressable
          onPress={onSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: tintColor },
            (pressed || saving) && { opacity: 0.75 },
          ]}>
          <ThemedText style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>
            {saving ? 'Simpan...' : 'Simpan'}
          </ThemedText>
        </Pressable>
      </View>

      {/* Info bar */}
      <View style={[styles.infoBar, { borderBottomColor: borderColor }]}>
        <ThemedText type="muted" style={{ fontSize: 13, flex: 1 }}>
          {selected.size} dari {profiles.length} anggota dipilih
        </ThemedText>
        <Pressable
          onPress={allSelected ? clearAll : selectAll}
          style={({ pressed }) => [styles.selectAllBtn, { borderColor: tintColor }, pressed && { opacity: 0.7 }]}>
          <ThemedText style={{ color: tintColor, fontSize: 13, fontWeight: '600' }}>
            {allSelected ? 'Hapus Semua' : 'Pilih Semua'}
          </ThemedText>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={tintColor} size="large" />
        </View>
      ) : profiles.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={48} color={mutedColor} />
          <ThemedText type="muted" style={{ marginTop: 12 }}>Belum ada akun anggota</ThemedText>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
          {profiles.map((p, i) => {
            const isChecked = selected.has(p.id);
            const nama = p.nama_lengkap ?? p.email ?? '(tanpa nama)';
            const sub = p.nama_lengkap ? p.email : null;
            return (
              <Pressable
                key={p.id}
                onPress={() => toggleMember(p.id)}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: borderColor },
                  i % 2 === 1 && { backgroundColor: 'rgba(127,127,127,0.03)' },
                  pressed && { opacity: 0.7 },
                ]}>
                {/* Checkbox */}
                <View style={[
                  styles.checkbox,
                  { borderColor: isChecked ? tintColor : borderColor },
                  isChecked && { backgroundColor: tintColor },
                ]}>
                  {isChecked && <Ionicons name="checkmark" size={14} color="white" />}
                </View>

                {/* Avatar */}
                <View style={[styles.avatar, { backgroundColor: tintColor + '18' }]}>
                  <ThemedText style={{ color: tintColor, fontWeight: '700', fontSize: 14 }}>
                    {nama.charAt(0).toUpperCase()}
                  </ThemedText>
                </View>

                {/* Nama */}
                <View style={{ flex: 1 }}>
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 14 }} numberOfLines={1}>
                    {nama}
                  </ThemedText>
                  {sub && (
                    <ThemedText type="muted" style={{ fontSize: 12 }} numberOfLines={1}>
                      {sub}
                    </ThemedText>
                  )}
                </View>

                {/* Badge */}
                {isChecked && (
                  <View style={[styles.badge, { backgroundColor: successColor + '18' }]}>
                    <ThemedText style={{ color: successColor, fontSize: 11, fontWeight: '600' }}>
                      Aktif
                    </ThemedText>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 90 },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    width: 90,
    alignItems: 'center',
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  selectAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
});
