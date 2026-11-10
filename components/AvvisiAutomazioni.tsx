'use client';

// Banner con gli invii automatici non riusciti (schedine Alloggiati Web): restano finché il titolare non li chiude.
// Funziona senza servizi esterni; il WhatsApp alla struttura (Twilio) è un canale in più.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, X } from 'lucide-react';

interface Avviso { id: string; struttura: string; operazione: string; ospite: string; errore: string; creato: string; riferimento?: string }

export default function AvvisiAutomazioni() {
  const [avvisi, setAvvisi] = useState<Avviso[]>([]);

  useEffect(() => {
    fetch('/api/automazioni/avvisi')
      .then(r => r.ok ? r.json() : [])
      .then((a: unknown) => { if (Array.isArray(a)) setAvvisi(a as Avviso[]); })
      .catch(() => {});
  }, []);

  async function chiudi(id: string) {
    setAvvisi(a => a.filter(x => x.id !== id));
    await fetch(`/api/automazioni/avvisi?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  }

  /** Non mostrare più: nasconde anche le copie degli altri giorni e impedisce che l'avviso torni */
  async function nonMostrarePiu(a: Avviso) {
    if (!confirm('Non mostrare più questo avviso? Non ricomparirà nemmeno nei prossimi giorni.')) return;
    setAvvisi(lista => lista.filter(x => x.id !== a.id && (!a.riferimento || x.riferimento !== a.riferimento)));
    await fetch(`/api/automazioni/avvisi?id=${encodeURIComponent(a.id)}&sempre=1`, { method: 'DELETE' }).catch(() => {});
  }

  if (avvisi.length === 0) return null;
  return (
    <div className="space-y-2 mb-5">
      {avvisi.map(a => (
        <div key={a.id} className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 text-sm">
            <div className="font-semibold text-red-800">{a.operazione} non riuscito · {a.struttura}</div>
            <div className="text-red-700 break-words">Ospite: {a.ospite}</div>
            <div className="text-red-700 break-words">Errore: {a.errore}</div>
            <div className="text-xs text-red-500 mt-1">
              {new Date(a.creato).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
              <Link href="/alloggiati" className="underline">Apri Alloggiati</Link> per correggere e inviare entro 24 ore dall&apos;arrivo
            </div>
            <button onClick={() => nonMostrarePiu(a)} className="mt-1.5 text-xs font-medium text-red-700 underline hover:text-red-900">
              Non mostrare più
            </button>
          </div>
          <button onClick={() => chiudi(a.id)} title="Chiudi" className="text-red-400 hover:text-red-700 shrink-0"><X size={16} /></button>
        </div>
      ))}
    </div>
  );
}
