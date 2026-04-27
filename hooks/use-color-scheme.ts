import { useColorSchemeOverride } from '@/hooks/use-color-scheme-override';

/**
 * Drop-in replacement untuk useColorScheme dari React Native.
 * Mengembalikan 'light' atau 'dark' berdasarkan pilihan user (atau sistem jika 'system').
 */
export function useColorScheme(): 'light' | 'dark' {
  const { resolved } = useColorSchemeOverride();
  return resolved;
}
