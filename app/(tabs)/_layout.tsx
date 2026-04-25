import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: false,
        tabBarStyle:
          Platform.OS === 'web'
            ? ({
                backgroundColor: Colors[colorScheme ?? 'light'].background,
                borderTopWidth: 1,
                borderTopColor: Colors[colorScheme ?? 'light'].border,
                marginBottom: 'var(--vv-bottom-inset, 0px)',
                height: 'calc(64px + env(safe-area-inset-bottom) + var(--vv-bottom-inset, 0px))',
                paddingBottom: 'calc(10px + env(safe-area-inset-bottom) + var(--vv-bottom-inset, 0px))',
                paddingTop: 8,
              } as any)
            : {
                backgroundColor: Colors[colorScheme ?? 'light'].background,
                borderTopWidth: 1,
                borderTopColor: Colors[colorScheme ?? 'light'].border,
                height: 64 + insets.bottom,
                paddingBottom: insets.bottom + 4,
                paddingTop: 8,
              },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Buku Kas',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="list.bullet.rectangle" color={color} />,
        }}
      />
      <Tabs.Screen
        name="absensi"
        options={{
          title: 'Absensi',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="checkmark.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="undian"
        options={{
          title: 'Undian',
          tabBarIcon: ({ color }) => <Ionicons name="dice" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Pengaturan',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="gearshape.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
