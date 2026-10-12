'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, Printer } from 'lucide-react';
import { Ricevuta, SerieRicevuta, SERIE_RICEVUTA } from '@/lib/types';
import { scaricaRicevuteMassivo } from '@/lib/ricevuta-pdf';

type Scelta = SerieRicevuta | 'tutte';

/** Ristampa di tutte le ricevute emesse in un periodo, per un controllo fiscale */
export default function RistampaRicevute({ serieIniziale, onChiudi }: {
  serieIniziale: SerieRicevuta;
  onChiudi: () => void;
}) {
  const anno = new Date().getFullYear();
  const [serie, setSerie] = useState<Scelta>(serieIniziale);
  const [dal, setDal] = useState(`${anno}-01-01`);
  const [al, setAl] = useState(`${anno}-12-31`);
  const [ricevute, setRicevute] = useState<Ricevuta[] | null>(null);
  const [errore, setErrore] = useState('');
  const [stampando, setStampando] = useState(false);

  useEffect(() => {
    if (!dal || !al) return;
    let annullato = false;
    setRicevute(null);
    setErrore('');
    const q = new URLSearchParams({ dal, al, ...(serie !== 'tutte' ? { serie } : {}) });
    fetch(`/api/ricevute?${q}`).then(r => r.json()).then((d: unknown) => {
      if (annullato) return;
      if (Array.isArray(d)) setRicevute(d as Ricevuta[]);
      else setErrore('Impossibile caricare le ricevute');
    }).catch(() => { if (!annullato) setErrore('Impossibile caricare le ricevute'); });
    return () => { annullato = true; };
  }, [serie, dal, al]);

  async function stampa() {
    if (!ricevute?.length) return;
    setStampando(true);
    try {
      await scaricaRicevuteMassivo(ricevute, dal, al);
    } finally {
      setStampando(false);
    }
  }

  const input = 'w-full border rounded px-3 py-2 text-sm';
  const riepilogo = (['privato', 'tassa'] as SerieRicevuta[]).map(s => {
    const elenco = (ricevute ?? []).filter(r => r.serie === s);
    return { s, n: elenco.length, totale: elenco.reduce((t, r) => t + r.importo + r.tassa, 0) };
  }).filter(x => serie === 'tutte' || x.s === serie);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onChiudi}>
      <div onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md rounded-t-xl sm:rounded-xl shadow-xl max-h-[90dvh] overflow-y-auto p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Printer size={18} className="text-blue-600" /> Ristampa ricevute
          </h2>
          <button type="button" onClick={onChiudi}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <p className="text-xs text-gray-500">
          Un unico PDF con il registro (elenco numerato, totale e numeri mancanti) e poi tutte le ricevute,
          una per pagina, identiche a quelle emesse.
        </p>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Serie</label>
          <select className={input} value={serie} onChange={e => setSerie(e.target.value as Scelta)}>
            <option value="privato">{SERIE_RICEVUTA.privato}</option>
            <option value="tassa">{SERIE_RICEVUTA.tassa}</option>
            <option value="tutte">Entrambe le serie</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Emesse dal</label>
            <input type="date" className={input} value={dal} onChange={e => setDal(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">al</label>
            <input type="date" className={input} value={al} onChange={e => setAl(e.target.value)} />
          </div>
        </div>

        <div className="bg-gray-50 rounded p-3 text-sm space-y-1">
          {ricevute === null && !errore && <div className="text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Caricamento…</div>}
          {errore && <div className="text-red-600">{errore}</div>}
          {ricevute && riepilogo.map(x => (
            <div key={x.s} className="flex justify-between">
              <span className="text-gray-600">{SERIE_RICEVUTA[x.s]}: <b>{x.n}</b> ricevute</span>
              <span className="font-medium">€{x.totale.toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onChiudi} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Chiudi</button>
          <button type="button" onClick={stampa} disabled={!ricevute?.length || stampando}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
            {stampando && <Loader2 size={14} className="animate-spin" />}
            Scarica PDF
          </button>
        </div>
      </div>
    </div>
  );
}
