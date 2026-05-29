'use client';

import { useState, useEffect, useCallback } from 'react';

export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  options?: { storage?: 'session' | 'local' }
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const useLocal = options?.storage === 'local';

  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const storage = useLocal ? localStorage : sessionStorage;
      const saved = storage.getItem(key);
      return saved !== null ? (JSON.parse(saved) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      const storage = useLocal ? localStorage : sessionStorage;
      storage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }, [key, state, useLocal]);

  const setPersistedState: React.Dispatch<React.SetStateAction<T>> = useCallback(
    (value) => setState(value),
    []
  );

  return [state, setPersistedState];
}
