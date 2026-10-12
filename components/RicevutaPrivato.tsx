'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, Receipt } from 'lucide-react';
import { Entrata, Prenotazione, Ricevuta, SOGLIA_BOLLO, ContoCorrente, TipoContoCorrente } from '@/lib/types';
import { scaricaRicevutaPdf } from '@/lib/ricevuta-pdf';

type Campi = {
  data_emissione: string;
  intestatario: string;
  codice_fiscale: string;
  indirizzo: string;
  descrizione: string;
  dal: string;
  al: string;
  tassa: string;
  bollo: boolean;
  mezzo_pagamento: string;
};

const MEZZI = ['Bonifico bancario', 'Pagamento elettronico (carta/POS)', 'Contanti', 'Altro pagamento elettronico'];
const MEZZO_DA_CONTO: Record<TipoContoCorrente, string> = {
  bonifico: MEZZI[0], pos: MEZZI[1], contanti: MEZZI[2], altro: MEZZI[3],
};

/** Prenotazione diretta della stessa camera che comprende la data dell'incasso */
function prenotazioneDi(e: Entrata, pren: Prenotazione[]): Prenotazione | undefined {
  const candidate = pren.filter(p =>
    p.stato !== 'cancellata' && (e.camera_id == null || p.camera_id === e.camera_id)
    && p.check_in.slice(0, 10) <= e.data && e.data <= p.check_out.slice(0, 10));
  return candidate.find(p => p.fonte === 'manuale' || p.fonte === 'sheet') ?? (e.camera_id != null ? candidate[0] : undefined);
}

export default function RicevutaPrivato({ entrata, ricevuta, contiCorrenti, onEmessa, onChiudi }: {
  entrata: Entrata;
  ricevuta?: Ricevuta;
  contiCorrenti: ContoCorrente[];
  onEmessa: (r: Ricevuta) => void;
  onChiudi: () => void;
}) {
  const [f, setF] = useState<Campi>(() => ricevuta ? {
    data_emissione: ricevuta.data_emissione,
    intestatario: ricevuta.intestatario,
    codice_fiscale: ricevuta.codice_fiscale,
    indirizzo: ricevuta.indirizzo,
    descrizione: ricevuta.descrizione,
    dal: ricevuta.dal ?? '',
    al: ricevuta.al ?? '',
    tassa: ricevuta.tassa > 0 ? String(ricevuta.tassa) : '',
    bollo: ricevuta.bollo,
    mezzo_pagamento: ricevuta.mezzo_pagamento,
  } : {
    data_emissione: entrata.data,
    intestatario: '',
    codice_fiscale: '',
    indirizzo: '',
    descrizione: 'Pernottamento',
    dal: '',
    al: '',
    tassa: '',
    bollo: entrata.importo > SOGLIA_BOLLO,
    mezzo_pagamento: MEZZO_DA_CONTO[contiCorrenti.find(c => c.nome === entrata.fonte_pagamento)?.tipo ?? 'contanti'],
  });
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState('');
  const [suggerita, setSuggerita] = useState('');
  const set = <K extends keyof Campi>(k: K, v: Campi[K]) => setF(p => ({ ...p, [k]: v }));

  // Prima emissione: dati dell'ospite e periodo dalla prenotazione corrispondente
  useEffect(() => {
    if (ricevuta) return;
    fetch('/api/prenotazioni').then(r => r.json()).then((pren: unknown) => {
      if (!Array.isArray(pren)) return;
      const p = prenotazioneDi(entrata, pren as Prenotazione[]);
      if (!p) return;
      setSuggerita(`${p.ospite_nome}, ${p.check_in.slice(0, 10)} → ${p.check_out.slice(0, 10)}`);
      setF(prev => ({
        ...prev,
        intestatario: prev.intestatario || p.ospite_nome,
        dal: prev.dal || p.check_in.slice(0, 10),
        al: prev.al || p.check_out.slice(0, 10),
        tassa: prev.tassa || (Number(p.tassa_soggiorno) > 0 ? String(p.tassa_soggiorno) : ''),
      }));
    }).catch(() => {});
  }, [entrata, ricevuta]);

  async function emetti(ev: React.FormEvent) {
    ev.preventDefault();
    setSalvando(true);
    setErrore('');
    try {
      const res = await fetch('/api/ricevute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, entrata_id: entrata.id, tassa: Number(f.tassa) || 0 }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Emissione non riuscita');
      onEmessa(d as Ricevuta);
      await scaricaRicevutaPdf(d as Ricevuta, entrata.fonte_pagamento);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  const totale = entrata.importo + (Number(f.tassa) || 0);
  const input = 'w-full border rounded px-3 py-2 text-sm';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onChiudi}>
      <form onSubmit={emetti} onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg rounded-t-xl sm:rounded-xl shadow-xl max-h-[90dvh] overflow-y-auto p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Receipt size={18} className="text-green-600" />
            {ricevuta ? `Ricevuta n. ${ricevuta.numero}/${ricevuta.anno}` : 'Nuova ricevuta'}
          </h2>
          <button type="button" onClick={onChiudi}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="text-xs text-gray-500">
          Incasso del {entrata.data.split('-').reverse().join('/')} · {entrata.descrizione} · <b>€{entrata.importo.toFixed(2)}</b>
          {suggerita && <div className="mt-1 text-green-700">Dati presi dalla prenotazione: {suggerita}</div>}
          {!ricevuta && <div className="mt-1">Il numero viene assegnato all&apos;emissione (progressivo per anno).</div>}
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Cognome e nome *</label>
          <input className={input} value={f.intestatario} onChange={e => set('intestatario', e.target.value)} required placeholder="Es. Bibi Benedetta Francesca" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Codice fiscale</label>
            <input className={`${input} uppercase`} value={f.codice_fiscale} onChange={e => set('codice_fiscale', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data ricevuta *</label>
            <input type="date" className={input} value={f.data_emissione} onChange={e => set('data_emissione', e.target.value)} required
              disabled={!!ricevuta} title={ricevuta ? 'Numero e anno già assegnati' : undefined} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Indirizzo di residenza</label>
          <input className={input} value={f.indirizzo} onChange={e => set('indirizzo', e.target.value)} placeholder="Via, CAP, città" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Causale</label>
          <input className={input} value={f.descrizione} onChange={e => set('descrizione', e.target.value)} />
          <p className="text-[11px] text-gray-400 mt-1">Sul PDF seguono il periodo e &quot;presso&quot; nome e indirizzo della struttura.</p>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Mezzo di pagamento</label>
          <select className={input} value={f.mezzo_pagamento} onChange={e => set('mezzo_pagamento', e.target.value)}>
            {[...new Set([...MEZZI, f.mezzo_pagamento].filter(Boolean))].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Soggiorno dal</label>
            <input type="date" className={input} value={f.dal} onChange={e => set('dal', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">al</label>
            <input type="date" className={input} value={f.al} onChange={e => set('al', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tassa di soggiorno (€)</label>
            <input type="number" min="0" step="0.01" className={input} value={f.tassa} onChange={e => set('tassa', e.target.value)} placeholder="0,00" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
            <input type="checkbox" checked={f.bollo} onChange={e => set('bollo', e.target.checked)} />
            Marca da bollo 2 €
          </label>
        </div>
        <p className="text-[11px] text-gray-400">
          La tassa si aggiunge al totale come voce a parte. La marca da bollo va applicata sopra €{SOGLIA_BOLLO.toFixed(2).replace('.', ',')}.
        </p>

        {errore && <div className="text-sm text-red-600">{errore}</div>}

        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-gray-600">Totale <b className="text-gray-900">€{totale.toFixed(2)}</b></span>
          <div className="flex gap-2">
            <button type="button" onClick={onChiudi} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Annulla</button>
            <button type="submit" disabled={salvando}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-60 flex items-center gap-1.5">
              {salvando && <Loader2 size={14} className="animate-spin" />}
              {ricevuta ? 'Aggiorna e scarica PDF' : 'Emetti e scarica PDF'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
