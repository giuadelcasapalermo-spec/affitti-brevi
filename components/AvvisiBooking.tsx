'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useCamere } from '@/hooks/useCamere';

interface Avviso {
  uid: string;
  camera_id: number;
  check_in: string;
  check_out: string;
}

const gm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Notti che Booking dà occupate ma che in app sono libere perché il blocco era stato eliminato:
 *  può essere una chiusura voluta o un ospite nuovo sulle stesse date. Decide l'utente.
 *  `aggiorna` cambia dopo ogni sync, per rileggere l'elenco. */
export default function AvvisiBooking({ aggiorna, onImportata }: { aggiorna?: unknown; onImportata?: () => void }) {
  const camere = useCamere();
  const [avvisi, setAvvisi] = useState<Avviso[]>([]);
  const [inCorso, setInCorso] = useState<string | null>(null);

  const carica = useCallback(() => {
    fetch('/api/avvisi-booking')
      .then((r) => (r.ok ? r.json() : []))
      .then((a) => setAvvisi(Array.isArray(a) ? a : []))
      .catch(() => {});
  }, []);

  useEffect(() => { carica(); }, [carica, aggiorna]);

  async function risolvi(uid: string, azione: 'importa' | 'ignora') {
    setInCorso(uid);
    try {
      await fetch('/api/avvisi-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, azione }),
      });
      if (azione === 'importa') {
        await fetch('/api/sync', { method: 'POST' });
        onImportata?.();
      }
      carica();
    } finally {
      setInCorso(null);
    }
  }

  if (avvisi.length === 0) return null;
  const nome = (id: number) => camere.find((c) => c.id === id)?.nome ?? `Camera ${id}`;

  return (
    <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 space-y-1.5">
      <div className="flex items-center gap-1.5 font-medium">
        <AlertTriangle size={15} />
        Booking risulta occupata, in app è libera
      </div>
      {avvisi.map((a) => (
        <div key={`${a.uid}-${a.check_in}`} className="flex flex-wrap items-center gap-2">
          <span className="flex-1 min-w-[10rem]">
            <b>{nome(a.camera_id)}</b> {gm(a.check_in)} → {gm(a.check_out)}
          </span>
          <button
            onClick={() => risolvi(a.uid, 'importa')}
            disabled={inCorso !== null}
            className="rounded bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {inCorso === a.uid ? 'Importo…' : 'Importa'}
          </button>
          <button
            onClick={() => risolvi(a.uid, 'ignora')}
            disabled={inCorso !== null}
            className="rounded border border-amber-400 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            title="È una chiusura fatta su Booking, non una prenotazione: non avvisare più"
          >
            Ignora
          </button>
        </div>
      ))}
    </div>
  );
}
