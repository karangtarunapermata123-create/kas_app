import { kv } from '@/lib/storage/kv';
import { useEffect, useState } from 'react';

export const ACCENT_COLORS = [
  { label: 'Indigo', value: '#4F46E5' },
  { label: 'Biru', value: '#007AFF' },
  { label: 'Teal', value: '#0891B2' },
  { label: 'Hijau', value: '#16A34A' },
  { label: 'Oranye', value: '#EA580C' },
  { label: 'Merah', value: '#DC2626' },
  { label: 'Pink', value: '#DB2777' },
  { label: 'Ungu', value: '#9333EA' },
];

const KEY = 'kas_app:accent_color';
const DEFAULT = '#4F46E5';

let _listeners: Array<(color: string) => void> = [];
let _current = DEFAULT;
let _loaded = false;

export function useAccentColor() {
  const [color, setColor] = useState(_current);

  useEffect(() => {
    if (!_loaded) {
      _loaded = true;
      kv().then(store => store.getItem(KEY)).then(v => {
        if (v) {
          _current = v;
          _listeners.forEach(l => l(v));
        }
      });
    }
    _listeners.push(setColor);
    return () => { _listeners = _listeners.filter(l => l !== setColor); };
  }, []);

  const setAccent = async (newColor: string) => {
    _current = newColor;
    const store = await kv();
    await store.setItem(KEY, newColor);
    _listeners.forEach(l => l(newColor));
  };

  return { accentColor: color, setAccent };
}
