import { Platform } from 'react-native';

export type KV = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

// --- Storage Sementara (Memory-based) ---
// Ini akan selalu berhasil dan tidak pernah crash,
// tapi data akan hilang jika aplikasi di-restart.
const memoryData = new Map<string, string>();

const memoryKV: KV = {
  getItem: async (key) => memoryData.get(key) || null,
  setItem: async (key, value) => { memoryData.set(key, value); },
  removeItem: async (key) => { memoryData.delete(key); },
};

// --- Web Storage (LocalStorage) ---
function webKV(): KV {
  return {
    getItem: async (key) => {
      try { return localStorage.getItem(key); } catch { return null; }
    },
    setItem: async (key, value) => {
      try { localStorage.setItem(key, value); } catch {}
    },
    removeItem: async (key) => {
      try { localStorage.removeItem(key); } catch {}
    },
  };
}

// --- Native Storage (AsyncStorage) ---
async function nativeKV(): Promise<KV> {
  try {
    const mod = require('@react-native-async-storage/async-storage');
    const AsyncStorage = mod.default || mod;

    if (!AsyncStorage || typeof AsyncStorage.getItem !== 'function') {
      throw new Error('AsyncStorage not found');
    }

    // Kita bungkus tiap metodenya dengan try-catch
    // agar jika native module "null" atau error di tengah jalan,
    // aplikasi tidak akan crash dan bisa ditangani.
    return {
      getItem: async (key) => {
        try {
          return await AsyncStorage.getItem(key);
        } catch (e) {
          console.warn('Native getItem failed, using memory:', e);
          return memoryData.get(key) || null;
        }
      },
      setItem: async (key, value) => {
        try {
          // Kita simpan di memori juga sebagai backup
          memoryData.set(key, value);
          await AsyncStorage.setItem(key, value);
        } catch (e) {
          console.warn('Native setItem failed, using memory:', e);
        }
      },
      removeItem: async (key) => {
        try {
          memoryData.delete(key);
          await AsyncStorage.removeItem(key);
        } catch (e) {
          console.warn('Native removeItem failed, using memory:', e);
        }
      },
    };
  } catch (e) {
    console.warn('Failed to initialize Native AsyncStorage:', e);
    throw e;
  }
}

let cached: KV | null = null;

export async function kv(): Promise<KV> {
  if (cached) return cached;

  if (Platform.OS === 'web') {
    cached = webKV();
    return cached;
  }

  try {
    // Kita coba gunakan Native Storage (AsyncStorage)
    cached = await nativeKV();
    return cached;
  } catch (e) {
    // JIKA GAGAL TOTAL (seperti error "Native module is null"),
    // kita paksa gunakan Memory Storage (sementara) agar aplikasi tetap jalan.
    console.error('CRITICAL: Using Temporary Memory Storage because Native failed.', e);
    cached = memoryKV;
    return cached;
  }
}

