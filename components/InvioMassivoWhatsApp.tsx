'use client';

// Invio massivo con il WhatsApp del dispositivo (link wa.me, nessun servizio esterno) agli ospiti
// della lista Prenotazioni filtrata. Il browser apre una sola chat per tocco e l'invio va confermato
// in WhatsApp: la finestra guida una coda, un ospite alla volta. Il testo del prossimo ospite viene
// preparato in anticipo, così la chat si apre subito al tocco (Safari blocca le aperture dopo un'attesa).
import { useEffect, useMemo, useState } from 'react';
import { X, MessageCircle, Loader2, Check, SkipForward } from 'lucide-react';
import type { Prenotazione } from '@/lib/types';
import { fData, numeroWhatsApp } from '@/lib/utils';

type Tipo = 'link' | 'istruzioni';
type Stato = { linkInviato: boolean; alloggiatiCount: number };

const TIPI: Record<Tipo, { label: string; descr: string; rotta: string; corpo: (id: string) => object }> = {
  link: {
    label: 'Link registrazione documenti',
    descr: 'Chiede all\'ospite di caricare i documenti prima dell\'arrivo.',
    rotta: '/api/alloggiati/invia-link',
    corpo: id => ({ prenotazione_id: id, canale: 'whatsapp_link' }),
  },
  istruzioni: {
    label: 'Istruzioni di check-in',
    descr: 'Il messaggio di check-in della struttura (Altro → Camere → Check-in).',
    rotta: '/api/alloggiati/invia-istruzioni',
    corpo: id => ({ prenotazione_id: id }),
  },
};

// Preselezione: il link a chi non l'ha ancora ricevuto e non ha documenti, le istruzioni a chi ha già i documenti
function preselezionato(tipo: Tipo, p: Prenotazione, s?: Stato): boolean {
  if (!p.ospite_telefono.trim()) return false;
  if (tipo === 'link') return !s?.linkInviato && !(s?.alloggiatiCount);
  return (s?.alloggiatiCount ?? 0) > 0;
}

export default function InvioMassivoWhatsApp({ prenotazioni, dal, al, checkinStatus, nomeCamera, onClose }: {
  prenotazioni: Prenotazione[];
  dal: string;
  al: string;
  checkinStatus: Record<string, Stato>;
  nomeCamera: (id: number) => string;
  onClose: () => void;
}) {
  const elenco = useMemo(() => prenotazioni.filter(p => p.stato !== 'cancellata'), [prenotazioni]);
  const [tipo, setTipo] = useState<Tipo>('link');
  const [selezionati, setSelezionati] = useState<Set<string>>(new Set());
  const [coda, setCoda] = useState<string[] | null>(null); // null: scelta destinatari
  const [indice, setIndice] = useState(0);
  const [testi, setTesti] = useState<Record<string, string>>({});
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [esiti, setEsiti] = useState<Record<string, 'aperto' | 'saltato'>>({});

  // Preselezione solo all'apertura e al cambio di messaggio: le scelte manuali restano anche se la pagina si aggiorna
  useEffect(() => {
    setSelezionati(new Set(elenco.filter(p => preselezionato(tipo, p, checkinStatus[p.id])).map(p => p.id)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  const corrente = coda ? elenco.find(p => p.id === coda[indice]) : undefined;

  // Prepara il testo dell'ospite corrente (per il link crea il link di registrazione sul server)
  useEffect(() => {
    if (!corrente || testi[corrente.id] || errori[corrente.id]) return;
    const id = corrente.id;
    fetch(TIPI[tipo].rotta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TIPI[tipo].corpo(id)),
    })
      .then(r => r.json())
      .then(j => j.ok ? setTesti(t => ({ ...t, [id]: j.testo })) : setErrori(e => ({ ...e, [id]: j.errore ?? 'Errore' })))
      .catch(() => setErrori(e => ({ ...e, [id]: 'Errore di rete' })));
  }, [corrente, tipo, testi, errori]);

  function avvia() {
    setCoda(elenco.filter(p => selezionati.has(p.id)).map(p => p.id));
    setIndice(0); setTesti({}); setErrori({}); setEsiti({});
  }

  function apri() {
    if (!corrente || !testi[corrente.id]) return;
    window.open(`https://wa.me/${numeroWhatsApp(corrente.ospite_telefono)}?text=${encodeURIComponent(testi[corrente.id])}`, '_blank');
    setEsiti(e => ({ ...e, [corrente.id]: 'aperto' }));
    setIndice(i => i + 1);
  }

  function salta() {
    if (!corrente) return;
    setEsiti(e => ({ ...e, [corrente.id]: 'saltato' }));
    setIndice(i => i + 1);
  }

  const toggle = (id: string) => setSelezionati(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const finito = coda !== null && indice >= coda.length;
  const aperti = Object.values(esiti).filter(e => e === 'aperto').length;

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-xl sm:rounded-xl shadow-xl max-h-[90dvh] flex flex-col pb-[env(safe-area-inset-bottom)] sm:pb-0" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-800 flex items-center gap-2"><MessageCircle size={18} className="text-green-600" />Invio WhatsApp agli ospiti</h2>
            <p className="text-xs text-gray-400">Arrivi dal {fData(dal)} al {fData(al)} · filtri della lista</p>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        {coda === null ? (
          <>
            <div className="px-5 py-4 space-y-2 border-b">
              {(Object.keys(TIPI) as Tipo[]).map(t => (
                <label key={t} className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="tipo" checked={tipo === t} onChange={() => setTipo(t)} className="mt-1" />
                  <span className="text-sm text-gray-700">{TIPI[t].label}<span className="block text-xs text-gray-400">{TIPI[t].descr}</span></span>
                </label>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {elenco.length === 0 && <p className="text-center text-sm text-gray-400 py-8">Nessuna prenotazione nel periodo filtrato</p>}
              {elenco.map(p => {
                const s = checkinStatus[p.id];
                const senzaTel = !p.ospite_telefono.trim();
                return (
                  <label key={p.id} className={`flex items-center gap-3 px-5 py-2.5 ${senzaTel ? 'opacity-50' : 'cursor-pointer hover:bg-gray-50'}`}>
                    <input type="checkbox" disabled={senzaTel} checked={selezionati.has(p.id)} onChange={() => toggle(p.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{p.ospite_nome || 'Senza nome'}</div>
                      <div className="text-xs text-gray-400">{fData(p.check_in)} · {nomeCamera(p.camera_id)} · {senzaTel ? 'telefono mancante' : p.ospite_telefono}</div>
                    </div>
                    <div className="text-[10px] text-right shrink-0 space-y-0.5">
                      {s?.linkInviato && <div className="text-blue-600">link inviato</div>}
                      {(s?.alloggiatiCount ?? 0) > 0 && <div className="text-green-600">{s.alloggiatiCount} doc.</div>}
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="px-5 py-4 border-t flex items-center justify-between gap-3">
              <span className="text-xs text-gray-500">{selezionati.size} ospiti selezionati</span>
              <button onClick={avvia} disabled={selezionati.size === 0}
                className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-40"
              >
                <MessageCircle size={15} />Inizia invio
              </button>
            </div>
          </>
        ) : finito ? (
          <div className="px-5 py-8 text-center space-y-3">
            <Check size={32} className="mx-auto text-green-600" />
            <p className="text-sm text-gray-700">{aperti} chat aperte su {coda.length}{Object.keys(errori).length ? ` · ${Object.keys(errori).length} con errore` : ''}</p>
            <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Chiudi</button>
          </div>
        ) : corrente && (
          <div className="px-5 py-5 space-y-4 overflow-y-auto">
            <div className="text-xs text-gray-400">Ospite {indice + 1} di {coda.length} · {TIPI[tipo].label}</div>
            <div>
              <div className="font-semibold text-gray-800">{corrente.ospite_nome}</div>
              <div className="text-xs text-gray-500">{fData(corrente.check_in)} · {nomeCamera(corrente.camera_id)} · {corrente.ospite_telefono}</div>
            </div>
            {errori[corrente.id] ? (
              <p className="text-sm text-red-600 bg-red-50 rounded p-3">{errori[corrente.id]}</p>
            ) : testi[corrente.id] ? (
              <div className="bg-gray-50 rounded p-3 text-xs text-gray-600 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">{testi[corrente.id]}</div>
            ) : (
              <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Preparo il messaggio…</p>
            )}
            <p className="text-xs text-gray-400">Si apre WhatsApp con il testo pronto: premi Invia, poi torna qui per il prossimo ospite.</p>
            <div className="flex items-center justify-between gap-2">
              <button onClick={salta} className="flex items-center gap-1 px-3 py-2 text-sm border rounded hover:bg-gray-50">
                <SkipForward size={14} />{errori[corrente.id] ? 'Avanti' : 'Salta'}
              </button>
              <button onClick={apri} disabled={!testi[corrente.id]}
                className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-40"
              >
                <MessageCircle size={15} />Apri WhatsApp
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
