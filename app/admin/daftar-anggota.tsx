import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAccentColor } from '@/hooks/use-accent-color';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Member = { id: string; email: string; nama_lengkap: string | null; role: string };

const ROLE_ORDER: Record<string, number> = { super_admin: 0, admin: 1, member: 2 };
const ROLE_LABEL: Record<string, string> = { super_admin: 'Super Admin', admin: 'Admin', member: 'Member' };

export default function DaftarAnggotaScreen() {
  const { accentColor } = useAccentColor();
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const mutedColor = useThemeColor({}, 'muted');
  const tintColor = useThemeColor({}, 'tint');

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, nama_lengkap, role')
        .order('nama_lengkap', { ascending: true });
      if (data) {
        const sorted = [...data].sort((a, b) => {
          const aO = ROLE_ORDER[a.role] ?? 3;
          const bO = ROLE_ORDER[b.role] ?? 3;
          if (aO !== bO) return aO - bO;
          return (a.nama_lengkap ?? '').localeCompare(b.nama_lengkap ?? '');
        });
        setMembers(sorted);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const roleColor = (role: string) => {
    if (role === 'super_admin') return '#ff6b35';
    if (role === 'admin') return accentColor;
    return mutedColor;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: borderColor }}>
        <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, width: 80 }}>
          <Ionicons name="chevron-back" size={24} color={tintColor} />
          <ThemedText style={{ color: tintColor, fontSize: 16 }}>Kembali</ThemedText>
        </Pressable>
        <ThemedText type="defaultSemiBold" style={{ flex: 1, textAlign: 'center', fontSize: 16 }}>
          Daftar Anggota
        </ThemedText>
        <View style={{ width: 80 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <Ionicons name="people-outline" size={48} color={mutedColor} />
          <ThemedText type="muted">Memuat...</ThemedText>
        </View>
      ) : members.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <Ionicons name="people-outline" size={48} color={mutedColor} />
          <ThemedText type="muted">Belum ada anggota.</ThemedText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }} showsVerticalScrollIndicator={false}>
          <ThemedText type="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            {members.length} anggota terdaftar
          </ThemedText>
          {members.map((m) => (
            <ThemedView key={m.id} type="card" style={{ borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {/* Avatar */}
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: roleColor(m.role) + '20', justifyContent: 'center', alignItems: 'center' }}>
                <ThemedText style={{ fontSize: 16, fontWeight: '700', color: roleColor(m.role) }}>
                  {(m.nama_lengkap ?? m.email).charAt(0).toUpperCase()}
                </ThemedText>
              </View>

              {/* Info */}
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" numberOfLines={1} style={{ fontSize: 14 }}>
                  {m.nama_lengkap ?? '—'}
                </ThemedText>
                <ThemedText type="muted" numberOfLines={1} style={{ fontSize: 12 }}>
                  {m.email}
                </ThemedText>
              </View>

              {/* Role badge */}
              <View style={{ backgroundColor: roleColor(m.role) + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                <ThemedText style={{ fontSize: 11, fontWeight: '600', color: roleColor(m.role) }}>
                  {ROLE_LABEL[m.role] ?? m.role}
                </ThemedText>
              </View>
            </ThemedView>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
