'use client';

import { useState, useEffect } from 'react';

const DEFAULT_NOME = 'Affitti Brevi';

let cache: { nome: string; logo: string } | null = null;
const listeners: Array<() => void> = [];

function notify() { listeners.forEach(fn => fn()); }

export function useNomeApp() {
  const [state, setState] = useState<{ nome: string; logo: string }>(
    cache ?? { nome: DEFAULT_NOME, logo: '/logo.svg' }
  );

  useEffect(() => {
    const update = () => setState(cache ?? { nome: DEFAULT_NOME, logo: '/logo.svg' });
    listeners.push(update);
    if (!cache) {
      fetch('/api/impostazioni')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          cache = {
            nome: data?.nome_app || DEFAULT_NOME,
            logo: data?.logo_url || '/logo.svg',
          };
          notify();
        })
        .catch(() => {});
    }
    return () => { const i = listeners.indexOf(update); if (i > -1) listeners.splice(i, 1); };
  }, []);

  return state;
}

export function invalidateNomeAppCache() {
  cache = null;
}
