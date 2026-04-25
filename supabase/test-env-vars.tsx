// =====================================================
// TEST ENVIRONMENT VARIABLES
// =====================================================
// Tambahkan kode ini di onCreateAccount untuk debug
// environment variables
// =====================================================

// Tambahkan di awal function onCreateAccount:
console.log('=== ENVIRONMENT VARIABLES DEBUG ===');
console.log('process.env.EXPO_PUBLIC_SUPABASE_URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log('process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

// Import dari client.ts
console.log('SUPABASE_URL from import:', SUPABASE_URL);
console.log('SUPABASE_ANON_KEY from import:', SUPABASE_ANON_KEY ? 'Present' : 'Missing');

// Constants dari expo
import Constants from 'expo-constants';
console.log('Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL:', Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL);
console.log('Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY:', Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY);

// Final values yang akan digunakan
const supabaseUrl = SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dtqilxwiezlrtneoaxdb.supabase.co';
const supabaseAnonKey = SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_fRFOL9FzPFAAhlWRLbnPvw_E0g3F3Ps';

console.log('Final supabaseUrl:', supabaseUrl);
console.log('Final supabaseAnonKey:', supabaseAnonKey ? 'Present' : 'Missing');
console.log('=== END DEBUG ===');

// =====================================================
// ALTERNATIF: HARDCODE VALUES (TEMPORARY)
// =====================================================
// Jika masih error, gunakan hardcode values sementara:

const HARDCODED_URL = 'https://dtqilxwiezlrtneoaxdb.supabase.co';
const HARDCODED_KEY = 'sb_publishable_fRFOL9FzPFAAhlWRLbnPvw_E0g3F3Ps';

const res = await fetch(`${HARDCODED_URL}/functions/v1/create-user`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${s.access_token}`,
    'apikey': HARDCODED_KEY,
  },
  body: JSON.stringify({ email, password: pass, namaLengkap: nama }),
});

// =====================================================
// CARA PENGGUNAAN:
// =====================================================
// 1. Tambahkan debug code di awal onCreateAccount
// 2. Lihat console browser untuk debug info
// 3. Jika masih undefined, gunakan hardcoded values
// 4. Pastikan Edge Functions sudah di-deploy
// =====================================================