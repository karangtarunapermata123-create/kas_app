import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase credentials missing! Check app.json or .env file.');
}

const storage = Platform.OS === 'web' ? undefined : AsyncStorage;

const supabaseOptions = {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
};

if (Platform.OS === 'web') {
  (supabaseOptions as any).realtime = {
    params: {
      eventsPerSecond: 10,
    },
  };
}

export const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '', supabaseOptions);

export { SUPABASE_URL, SUPABASE_ANON_KEY };
