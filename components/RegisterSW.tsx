'use client';

import { useEffect } from 'react';

export default function RegisterSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Deregistra qualsiasi SW esistente e pulisce la cache
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
    });
    caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  }, []);
  return null;
}
