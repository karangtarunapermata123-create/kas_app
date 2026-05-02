import { kv } from '@/lib/storage/kv';
import { useEffect, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

export type ColorSchemeOverride = 'system' | 'light' | 'dark';

const KEY = 'kas_app:color_scheme';
const DEFAULT: ColorSchemeOverride = 'system';

let _listeners: Array<(v: ColorSchemeOverride) => void> = [];
let _current: ColorSchemeOverride = DEFAULT;
let _loaded = false;

export function useColorSchemeOverride() {
  const systemScheme = useSystemColorScheme();
  const [override, setOverride] = useState<ColorSchemeOverride>(_current);

  useEffect(() => {
    // Register listener FIRST before loading, to avoid missing the update
    _listeners.push(setOverride);

    if (!_loaded) {
      _loaded = true;
      kv()
        .then(store => store.getItem(KEY))
        .then(v => {
          if (v === 'light' || v === 'dark' || v === 'system') {
            _current = v;
            _listeners.forEach(l => l(v));
          }
        })
        .catch(() => {
          // Storage failed, keep default
        });
    } else {
      // Already loaded — sync this component with current value
      setOverride(_current);
    }

    return () => {
      _listeners = _listeners.filter(l => l !== setOverride);
    };
  }, []);

  const setScheme = async (value: ColorSchemeOverride) => {
    _current = value;
    _listeners.forEach(l => l(value));
    try {
      const store = await kv();
      await store.setItem(KEY, value);
    } catch {
      // Storage failed, value still applied in-memory for this session
    }
  };

  // Resolve ke 'light' atau 'dark'
  const resolved = override === 'system' ? (systemScheme ?? 'light') : override;

  return { override, resolved, setScheme };
}
