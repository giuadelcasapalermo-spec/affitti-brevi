'use client';
import { useState, useEffect } from 'react';
import { Struttura } from '@/lib/types';

export function useStruttura() {
  const [strutture, setStrutture] = useState<Struttura[]>([]);
  const [strutturaId, setStrutturaIdState] = useState<string>('');

  useEffect(() => {
    const saved = document.cookie.split('; ').find(r => r.startsWith('struttura_id='))?.split('=')[1] ?? '';
    setStrutturaIdState(saved);
    fetch('/api/strutture').then(r => r.json()).then((s: Struttura[]) => {
      setStrutture(s);
      if (!saved && s.length > 0) {
        setStruttura(s[0].id);
      }
    }).catch(() => {});
  }, []);

  function setStruttura(id: string) {
    document.cookie = `struttura_id=${id}; path=/; max-age=31536000; SameSite=Lax`;
    setStrutturaIdState(id);
  }

  const struttura = strutture.find(s => s.id === strutturaId) ?? strutture[0] ?? null;
  return { struttura, strutture, strutturaId, setStruttura };
}
