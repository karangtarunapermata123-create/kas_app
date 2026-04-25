import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAdmin } from '@/lib/admin/admin-context';

export function AdminLogin() {
  const { signIn } = useAdmin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'muted');
  const borderColor = useThemeColor({}, 'border');

  const onSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Validasi', 'Email dan password tidak boleh kosong.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password.trim());
    } catch (e: any) {
      Alert.alert('Login Gagal', e?.message ?? 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor }]} edges={['top']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          <View style={s.container}>
            <View style={[s.iconBox, { backgroundColor: tintColor + '15' }]}>
              <Ionicons name="wallet" size={48} color={tintColor} />
            </View>
            <ThemedText type="title" style={s.title}>Buku Kas</ThemedText>
            <ThemedText type="muted" style={s.subtitle}>Login untuk melanjutkan</ThemedText>

            <ThemedView type="card" style={s.card}>
              <ThemedText type="defaultSemiBold" style={s.label}>Email</ThemedText>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="email@contoh.com"
                placeholderTextColor={mutedColor}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[s.input, { color: textColor, borderColor }]}
              />
              <ThemedText type="defaultSemiBold" style={s.label}>Password</ThemedText>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={mutedColor}
                secureTextEntry
                style={[s.input, { color: textColor, borderColor }]}
              />
              <Pressable
                onPress={onSubmit}
                disabled={loading}
                style={({ pressed }) => [s.btn, { backgroundColor: tintColor }, pressed && { opacity: 0.8 }]}>
                <Ionicons name="log-in-outline" size={20} color="white" />
                <ThemedText type="defaultSemiBold" style={{ color: 'white', fontSize: 16 }}>
                  {loading ? 'Loading...' : 'Login'}
                </ThemedText>
              </Pressable>
            </ThemedView>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 8 },
  iconBox: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 8 },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: 16 },
  card: { padding: 20, borderRadius: 20, gap: 8 },
  label: { fontSize: 14, opacity: 0.7 },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 16, marginBottom: 4 },
  btn: { paddingVertical: 15, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 },
});
