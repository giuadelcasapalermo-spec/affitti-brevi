'use client';
import { useEffect, useState } from 'react';

export function useSoloCalendario(): boolean {
  const [sc, setSc] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('sc') === '1';
  });

  useEffect(() => {
    if (sessionStorage.getItem('sc') !== null) return;
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const val = data?.solo_calendario === true;
        sessionStorage.setItem('sc', val ? '1' : '0');
        setSc(val);
      })
      .catch(() => {});
  }, []);

  return sc;
}

export function clearSoloCalendarioCache() {
  if (typeof window !== 'undefined') sessionStorage.removeItem('sc');
}
