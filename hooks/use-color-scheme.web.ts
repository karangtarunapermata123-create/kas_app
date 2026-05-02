import { useColorSchemeOverride } from '@/hooks/use-color-scheme-override';
import { useEffect, useState } from 'react';

/**
 * Web version: supports static rendering hydration while also
 * respecting the user's color scheme override (light/dark/system).
 */
export function useColorScheme(): 'light' | 'dark' {
  const [hasHydrated, setHasHydrated] = useState(false);
  const { resolved } = useColorSchemeOverride();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (hasHydrated) {
    return resolved;
  }

  return 'light';
}
