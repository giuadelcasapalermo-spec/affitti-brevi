'use client';

// Riepilogo degli invii all'Osservatorio Turistico della Regione Siciliana (Turist@t) per gli arrivi di un mese
import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2, CheckCircle2, Clock, AlertCircle, FileX, Settings } from 'lucide-react';
import Link from 'next/link';
import { useCamere } from '@/hooks/useCamere';
import { useEtichette } from '@/hooks/useEtichette';
import type { SoggiornoTuristat, StatoTuristat } from '@/app/api/osservatorio/riepilogo/route';

interface Riepilogo {
  dal: string;
  al: string;
  soggiorni: SoggiornoTuristat[];
  chiusure: { codice: string; ultima: string | null }[];
  automatico: { attivo: boolean; dal: string };
  configurato: boolean;
}

const STATI: Record<StatoTuristat, { label: string; classe: string; icona: typeof CheckCircle2 }> = {
  completo:     { label: 'Arrivo e partenza', classe: 'bg-teal-50 text-teal-700 border-teal-200',    icona: CheckCircle2 },
  solo_arrivo:  { label: 'Solo arrivo',       classe: 'bg-blue-50 text-blue-700 border-blue-200',    icona: Clock },
  parziale:     { label: 'Parziale',          classe: 'bg-amber-50 text-amber-700 border-amber-200', icona: AlertCircle },
  da_inviare:   { label: 'Da inviare',        classe: 'bg-red-50 text-red-700 border-red-200',       icona: AlertCircle },
  senza_schede: { label: 'Senza schede',      classe: 'bg-gray-50 text-gray-500 border-gray-200',    icona: FileX },
};

const fData = (iso: string) => { try { return format(parseISO(iso), 'dd/MM'); } catch { return iso; } };
const fDataOra = (iso: string) => { try { return format(parseISO(iso), 'dd/MM/yyyy HH:mm'); } catch { return iso; } };
const fonteLabel = (f: SoggiornoTuristat['fonte']) =>
  f === 'ical' || f === 'booking' ? 'Booking' : f === 'airbnb' ? 'Airbnb' : f === 'manuale' ? 'Diretta' : f ? f : 'Senza prenotazione';

export default function Turistat() {
  const camere = useCamere();
  const et = useEtichette();
  const oggi = new Date();
  const [anno, setAnno] = useState(oggi.getFullYear());
  const [mese, setMese] = useState(oggi.getMonth() + 1);
  const [dati, setDati] = useState<Riepilogo | null>(null);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  const carica = useCallback(async (a: number, m: number) => {
    setLoading(true);
    setErrore(null);
    try {
      const res = await fetch(`/api/osservatorio/riepilogo?anno=${a}&mese=${m}`);
      if (!res.ok) throw new Error(`Errore ${res.status}`);
      setDati(await res.json());
    } catch {
      setDati(null);
      setErrore('Impossibile caricare il riepilogo. Riprova.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carica(anno, mese); }, [anno, mese, carica]);

  function sposta(delta: number) {
    const d = new Date(anno, mese - 1 + delta, 1);
    setAnno(d.getFullYear());
    setMese(d.getMonth() + 1);
  }

  const nomeCamera = (id: number | null) => id == null ? '' : camere.find(c => c.id === id)?.nome ?? `${et.Camera} ${id}`;
  const conta = (s: StatoTuristat) => dati?.soggiorni.filter(x => x.stato === s).length ?? 0;
  const ospitiComunicati = dati?.soggiorni.reduce((n, x) => n + x.arrivi_inviati, 0) ?? 0;
  const titolo = format(new Date(anno, mese - 1, 1), 'MMMM yyyy', { locale: it });

  return (
    <div className="space-y-4">
      {/* Mese */}
      <div className="flex items-center gap-2">
        <button onClick={() => sposta(-1)} className="p-1.5 rounded hover:bg-gray-100" aria-label="Mese precedente"><ChevronLeft size={16} /></button>
        <span className="font-semibold text-gray-800 text-sm capitalize w-36 text-center">{titolo}</span>
        <button onClick={() => sposta(1)} className="p-1.5 rounded hover:bg-gray-100" aria-label="Mese successivo"><ChevronRight size={16} /></button>
        <span className="text-xs text-gray-400 hidden sm:inline">arrivi del mese</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-gray-400"><Loader2 className="animate-spin" /></div>
      ) : errore || !dati ? (
        <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{errore}</div>
      ) : (
        <>
          {/* Stato del collegamento */}
          <div className="bg-white rounded-xl shadow-sm p-4 text-sm space-y-1.5">
            {!dati.configurato ? (
              <p className="text-amber-700">Credenziali dell&apos;Osservatorio non configurate (Altro → Strutture).</p>
            ) : (
              <>
                <p className="text-gray-700">
                  Invio automatico serale:{' '}
                  <span className={dati.automatico.attivo ? 'text-teal-700 font-medium' : 'text-gray-500'}>
                    {dati.automatico.attivo ? `attivo${dati.automatico.dal ? ` (arrivi dal ${format(parseISO(dati.automatico.dal), 'dd/MM/yyyy')})` : ''}` : 'spento'}
                  </span>
                </p>
                {dati.chiusure.map(c => (
                  <p key={c.codice} className="text-gray-500 text-xs">
                    Ultima chiusura giornaliera <span className="font-mono">{c.codice}</span>:{' '}
                    {c.ultima ? format(parseISO(c.ultima), 'dd/MM/yyyy') : 'nessuna inviata dall\'app'}
                  </p>
                ))}
              </>
            )}
            <Link href="/impostazioni" className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline">
              <Settings size={12} /> Invio storico e impostazioni: Altro → {et.Camere} → Check-in
            </Link>
          </div>

          {/* Totali */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {([
              ['Comunicati', conta('completo'), 'text-teal-700'],
              ['Solo arrivo', conta('solo_arrivo'), 'text-blue-700'],
              ['Da inviare', conta('da_inviare') + conta('parziale'), 'text-red-600'],
              ['Senza schede', conta('senza_schede'), 'text-gray-500'],
              ['Ospiti comunicati', ospitiComunicati, 'text-gray-800'],
            ] as const).map(([label, n, colore]) => (
              <div key={label} className="bg-white rounded-xl shadow-sm px-3 py-2.5">
                <div className="text-[11px] text-gray-400">{label}</div>
                <div className={`text-xl font-bold ${colore}`}>{n}</div>
              </div>
            ))}
          </div>

          {/* Soggiorni */}
          {dati.soggiorni.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-10">Nessun arrivo in questo mese</div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
              {dati.soggiorni.map(x => {
                const st = STATI[x.stato];
                const Icona = st.icona;
                return (
                  <div key={x.chiave} className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 text-sm truncate">{x.ospite || '—'}</div>
                      <div className="text-xs text-gray-500">
                        {fData(x.check_in)} → {fData(x.check_out)}
                        {x.camera_id != null && <> · {nomeCamera(x.camera_id)}</>}
                        {' · '}{fonteLabel(x.fonte)}
                      </div>
                      {x.stato !== 'senza_schede' && (
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {x.ospiti} {x.ospiti === 1 ? 'ospite' : 'ospiti'} · arrivo {x.arrivi_inviati}/{x.ospiti} · partenza {x.partenze_inviate}/{x.ospiti}
                          {x.ultimo_invio && <> · ultimo invio {fDataOra(x.ultimo_invio)}</>}
                        </div>
                      )}
                      {x.stato === 'senza_schede' && (
                        <div className="text-[11px] text-gray-400 mt-0.5">Nessuna scheda ospite in Alloggiati: non può essere inviata</div>
                      )}
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-medium border rounded-full px-2 py-0.5 ${st.classe}`}>
                      <Icona size={11} /> {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
