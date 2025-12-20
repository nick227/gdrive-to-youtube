import { useCallback, useEffect, useState } from 'react';

/**
 * Toggle state that hydrates from and persists to localStorage.
 * Guards against SSR by checking for window availability.
 */
export function usePersistedToggle(key: string, initial = false) {
  const [open, setOpen] = useState(initial);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(key);
    if (raw === 'true' || raw === 'false') {
      setOpen(raw === 'true');
    } else {
      setOpen(initial);
    }
  }, [key, initial]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, String(open));
  }, [key, open]);

  const toggle = useCallback(() => setOpen(v => !v), []);

  return { open, toggle, setOpen };
}
