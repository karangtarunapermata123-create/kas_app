import { supabase } from '@/lib/supabase/client';

/**
 * Clear all authentication data from storage
 * Useful when dealing with corrupted or invalid refresh tokens
 */
export async function clearAuthStorage(): Promise<void> {
  try {
    // Sign out to clear session
    await supabase.auth.signOut();
    
    // Clear localStorage if available (web)
    if (typeof window !== 'undefined' && window.localStorage) {
      const keysToRemove = [];
      
      // Find all supabase auth related keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-')) {
          keysToRemove.push(key);
        }
      }
      
      // Remove all found keys
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      console.log('Cleared auth storage keys:', keysToRemove);
    }
    
    // Clear sessionStorage if available (web)
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const keysToRemove = [];
      
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('sb-')) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        sessionStorage.removeItem(key);
      });
    }
    
    console.log('Auth storage cleared successfully');
  } catch (error) {
    console.error('Error clearing auth storage:', error);
  }
}

/**
 * Check if current session is valid
 */
export async function validateSession(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log('Session validation error:', error.message);
      return false;
    }
    
    return !!data.session;
  } catch (error) {
    console.error('Session validation failed:', error);
    return false;
  }
}

/**
 * Refresh session manually
 */
export async function refreshSession(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.log('Session refresh error:', error.message);
      return false;
    }
    
    return !!data.session;
  } catch (error) {
    console.error('Session refresh failed:', error);
    return false;
  }
}

/**
 * Safe auth initialization - handles common auth errors gracefully
 */
export async function safeAuthInit(): Promise<{ session: any; error: string | null }> {
  try {
    // First, try to get current session
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      // If there's an error, clear storage and return clean state
      console.log('Auth init error, clearing storage:', error.message);
      await clearAuthStorage();
      return { session: null, error: error.message };
    }
    
    return { session: data.session, error: null };
  } catch (error: any) {
    console.error('Safe auth init failed:', error);
    await clearAuthStorage();
    return { session: null, error: error.message || 'Unknown auth error' };
  }
}