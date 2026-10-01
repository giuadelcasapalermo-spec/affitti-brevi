'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { useStruttura } from '@/hooks/useStruttura';
import {
  DatiFiscali, RegoleStruttura, ContoCorrente, TipoContoCorrente, TIPI_CONTO,
  DATI_FISCALI_VUOTI, REGOLE_DEFAULT, Struttura,
} from '@/lib/types';
import { MODELLO_ISTRUZIONI_BASE, SEGNAPOSTO_ISTRUZIONI, componiIstruzioni } from '@/lib/istruzioni';

// Configurazione guidata della struttura attiva: un passo per volta, salvataggio a ogni "Avanti"

const PASSI = [
  'Titolare', 'Struttura', 'Camere', 'Canali', 'Alloggiati Web', 'Regole', 'Check-in', 'Riepilogo',
] as const;

const TIPOLOGIE = [
  'Locazione turistica', 'Casa vacanze', 'B&B', 'Affittacamere', 'Guest house', 'Altro',
];

const inputCls = 'w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';

function Campo({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="text-xs text-gray-400 block">{hint}</span>}
    </label>
  );
}

export default function ConfigurazionePage() {
  const router = useRouter();
  const { struttura } = useStruttura();
  const [passo, setPasso] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState('');

  const [nome, setNome] = useState('');
  const [indirizzo, setIndirizzo] = useState('');
  const [fiscali, setFiscali] = useState<DatiFiscali>(DATI_FISCALI_VUOTI);
  const [regole, setRegole] = useState<RegoleStruttura>(REGOLE_DEFAULT);
  const [numCamere, setNumCamere] = useState(1);
  const [nomiCamere, setNomiCamere] = useState<Record<number, string>>({});
  const [prezziCamere, setPrezziCamere] = useState<Record<number, number>>({});
  const [icalUrls, setIcalUrls] = useState<Record<number, string>>({});
  const [alloggiati, setAlloggiati] = useState({ utente: '', password: '', wskey: '' });
  const [mostraPassword, setMostraPassword] = useState(false);
  const [conti, setConti] = useState<ContoCorrente[]>([]);
  const [istruzioni, setIstruzioni] = useState('');

  // Precompila dai dati già salvati (il wizard si può riaprire da Altro → Strutture)
  useEffect(() => {
    if (!struttura) return;
    setNome(struttura.nome === 'Struttura principale' ? '' : struttura.nome);
    setIndirizzo(struttura.indirizzo ?? '');
    setFiscali(struttura.dati_fiscali);
    setRegole(struttura.regole);
    setNumCamere(struttura.num_camere || 1);
    setNomiCamere(struttura.nomi_camere);
    setPrezziCamere(struttura.prezzi_camere);
    setIcalUrls(struttura.ical_urls);
    setAlloggiati({
      utente: struttura.alloggiati_credentials?.utente ?? '',
      password: struttura.alloggiati_credentials?.password ?? '',
      wskey: struttura.alloggiati_credentials?.wskey ?? '',
    });
    setConti(struttura.conti_correnti);
    setIstruzioni(struttura.istruzioni_checkin || MODELLO_ISTRUZIONI_BASE);
  }, [struttura]);

  const camere = Array.from({ length: numCamere }, (_, i) => i + 1);
  const setF = (k: keyof DatiFiscali) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFiscali(f => ({ ...f, [k]: e.target.value }));
  const setR = (k: keyof RegoleStruttura, numerico = true) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setRegole(r => ({ ...r, [k]: numerico ? Number(e.target.value) : e.target.value }));

  // Campi obbligatori per passo (gli altri si possono completare dopo)
  function validaPasso(): string {
    if (passo === 0 && (!fiscali.ragione_sociale.trim() || !fiscali.partita_iva.trim() && !fiscali.codice_fiscale.trim()))
      return 'Indicare ragione sociale e almeno partita IVA o codice fiscale';
    if (passo === 1 && (!nome.trim() || !indirizzo.trim())) return 'Indicare nome e indirizzo della struttura';
    if (passo === 1 && fiscali.cin && !/^IT[A-Z0-9]{10,}$/i.test(fiscali.cin.replace(/\s/g, '')))
      return 'Il CIN inizia con IT seguito dal codice rilasciato dalla banca dati BDSR';
    if (passo === 2 && camere.some(id => !(prezziCamere[id] > 0))) return 'Indicare un prezzo base per ogni camera';
    if (passo === 5 && !(regole.tassa_max_notti > 0)) return 'Indicare le notti massime tassabili';
    if (passo === 6 && !istruzioni.trim()) return 'Il messaggio di check-in non può essere vuoto';
    return '';
  }

  function datiPasso(): Partial<Struttura> {
    switch (passo) {
      case 0: return { dati_fiscali: fiscali };
      case 1: return { nome: nome.trim(), indirizzo: indirizzo.trim(), dati_fiscali: fiscali, regole };
      case 2: return {
        num_camere: numCamere,
        nomi_camere: Object.fromEntries(camere.map(id => [id, nomiCamere[id]?.trim() || `Camera ${id}`])),
        prezzi_camere: Object.fromEntries(camere.map(id => [id, prezziCamere[id]])),
      };
      case 3: return { ical_urls: Object.fromEntries(camere.filter(id => icalUrls[id]?.trim()).map(id => [id, icalUrls[id].trim()])) };
      case 4: return alloggiati.utente ? { alloggiati_credentials: alloggiati } : {};
      case 5: return { regole, conti_correnti: conti.length ? conti : [{ id: 'contanti-default', tipo: 'contanti', nome: 'Contanti' }] };
      case 6: return { istruzioni_checkin: istruzioni };
      default: return {};
    }
  }

  async function avanti() {
    const e = validaPasso();
    if (e) { setErrore(e); return; }
    setErrore('');
    if (!struttura) return;
    setSalvando(true);
    try {
      const body = datiPasso();
      if (Object.keys(body).length) {
        const res = await fetch(`/api/strutture/${struttura.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Salvataggio non riuscito');
      }
      if (passo === PASSI.length - 1) {
        await fetch('/api/configurazione', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completata: true }),
        });
        router.push('/calendario');
        router.refresh();
        return;
      }
      setPasso(p => p + 1);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : String(err));
    } finally {
      setSalvando(false);
    }
  }

  function toggleConto(tipo: TipoContoCorrente) {
    setConti(c => c.some(x => x.tipo === tipo)
      ? c.filter(x => x.tipo !== tipo)
      : [...c, { id: crypto.randomUUID(), tipo, nome: TIPI_CONTO[tipo] }]);
  }

  if (!struttura) {
    return <div className="flex justify-center py-20 text-gray-400"><Loader2 className="animate-spin" /></div>;
  }

  const anteprima = componiIstruzioni(istruzioni, {
    ospite: 'Mario Rossi', camera: 1, tassa: `€${(regole.tassa_tariffa * 2 * Math.min(3, regole.tassa_max_notti)).toFixed(0)}`,
    indirizzo: indirizzo || 'Via Esempio 1', struttura: nome || 'la struttura',
  });

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Configurazione della struttura</h1>
        <p className="text-sm text-gray-500">Passo {passo + 1} di {PASSI.length}: {PASSI[passo]}. I dati si salvano a ogni passo.</p>
      </div>

      {/* Avanzamento */}
      <ol className="flex gap-1">
        {PASSI.map((t, i) => (
          <li key={t} className="flex-1">
            <button
              type="button"
              onClick={() => i < passo && setPasso(i)}
              disabled={i > passo}
              title={t}
              className={`w-full h-1.5 rounded-full ${i < passo ? 'bg-blue-600 cursor-pointer' : i === passo ? 'bg-blue-400' : 'bg-gray-200'}`}
            />
            <span className={`hidden sm:block text-[10px] mt-1 text-center ${i === passo ? 'text-blue-700 font-semibold' : 'text-gray-400'}`}>{t}</span>
          </li>
        ))}
      </ol>

      <div className="bg-white rounded-lg shadow-sm p-5 space-y-4">
        {passo === 0 && (<>
          <p className="text-sm text-gray-600">Dati della ragione sociale che gestisce la struttura, come in visura camerale.</p>
          <Campo label="Ragione sociale *" hint="Per le persone fisiche: nome e cognome">
            <input className={inputCls} value={fiscali.ragione_sociale} onChange={setF('ragione_sociale')} />
          </Campo>
          <div className="grid sm:grid-cols-2 gap-4">
            <Campo label="Partita IVA">
              <input className={inputCls} value={fiscali.partita_iva} onChange={setF('partita_iva')} inputMode="numeric" maxLength={11} />
            </Campo>
            <Campo label="Codice fiscale">
              <input className={inputCls} value={fiscali.codice_fiscale} onChange={setF('codice_fiscale')} maxLength={16} />
            </Campo>
          </div>
          <Campo label="Sede legale">
            <input className={inputCls} value={fiscali.sede_legale} onChange={setF('sede_legale')} />
          </Campo>
          <Campo label="PEC">
            <input className={inputCls} type="email" value={fiscali.pec} onChange={setF('pec')} />
          </Campo>
        </>)}

        {passo === 1 && (<>
          <Campo label="Nome della struttura *" hint="Come appare negli annunci e nei messaggi agli ospiti">
            <input className={inputCls} value={nome} onChange={e => setNome(e.target.value)} />
          </Campo>
          <Campo label="Indirizzo *">
            <input className={inputCls} value={indirizzo} onChange={e => setIndirizzo(e.target.value)} />
          </Campo>
          <div className="grid sm:grid-cols-2 gap-4">
            <Campo label="Comune">
              <input className={inputCls} value={regole.comune} onChange={setR('comune', false)} />
            </Campo>
            <Campo label="Tipologia ricettiva">
              <select className={inputCls} value={fiscali.tipologia} onChange={setF('tipologia')}>
                <option value="">Selezionare…</option>
                {TIPOLOGIE.map(t => <option key={t}>{t}</option>)}
              </select>
            </Campo>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Campo label="CIN" hint="Codice Identificativo Nazionale, dalla banca dati BDSR del Ministero del Turismo">
              <input className={inputCls} value={fiscali.cin} onChange={setF('cin')} placeholder="IT…" />
            </Campo>
            <Campo label="CIR / codice regionale" hint="Dal portale turistico della Regione">
              <input className={inputCls} value={fiscali.cir} onChange={setF('cir')} />
            </Campo>
          </div>
        </>)}

        {passo === 2 && (<>
          <Campo label="Numero di camere o unità">
            <input className={inputCls} type="number" min={1} max={30} value={numCamere}
              onChange={e => setNumCamere(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} />
          </Campo>
          <div className="space-y-2">
            <div className="grid grid-cols-[2rem_1fr_7rem] gap-2 text-xs text-gray-500 font-medium">
              <span>N.</span><span>Nome</span><span>Prezzo base €/notte *</span>
            </div>
            {camere.map(id => (
              <div key={id} className="grid grid-cols-[2rem_1fr_7rem] gap-2 items-center">
                <span className="text-sm text-gray-500">{id}</span>
                <input className={inputCls} placeholder={`Camera ${id}`} value={nomiCamere[id] ?? ''}
                  onChange={e => setNomiCamere(n => ({ ...n, [id]: e.target.value }))} />
                <input className={inputCls} type="number" min={0} value={prezziCamere[id] ?? ''}
                  onChange={e => setPrezziCamere(p => ({ ...p, [id]: Number(e.target.value) }))} />
              </div>
            ))}
          </div>
        </>)}

        {passo === 3 && (<>
          <p className="text-sm text-gray-600">
            URL iCal di esportazione da Booking.com (Extranet → Tariffe e disponibilità → Sincronizza calendari)
            e Airbnb (Calendario → Disponibilità → Collega calendari). Facoltativo: si può aggiungere anche dopo, in Altro → iCal.
          </p>
          {camere.map(id => (
            <Campo key={id} label={nomiCamere[id]?.trim() || `Camera ${id}`}>
              <input className={inputCls} type="url" placeholder="https://ical.booking.com/v1/export?…" value={icalUrls[id] ?? ''}
                onChange={e => setIcalUrls(u => ({ ...u, [id]: e.target.value }))} />
            </Campo>
          ))}
        </>)}

        {passo === 4 && (<>
          <p className="text-sm text-gray-600">
            Credenziali del portale Alloggiati Web della Polizia di Stato, per inviare le schede ospiti dall&apos;app.
            Facoltativo: lasciare vuoto per inserirle più tardi.
          </p>
          <Campo label="Utente">
            <input className={inputCls} autoComplete="off" value={alloggiati.utente} onChange={e => setAlloggiati(a => ({ ...a, utente: e.target.value }))} />
          </Campo>
          <Campo label="Password">
            <div className="relative">
              <input className={inputCls} autoComplete="new-password" type={mostraPassword ? 'text' : 'password'} value={alloggiati.password}
                onChange={e => setAlloggiati(a => ({ ...a, password: e.target.value }))} />
              <button type="button" onClick={() => setMostraPassword(m => !m)} className="absolute right-2 top-2 text-gray-400">
                {mostraPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Campo>
          <Campo label="Chiave Web Service (WSKey)" hint="Si genera sul portale Alloggiati Web → Profilo → Chiave Web Service">
            <input className={inputCls} autoComplete="off" value={alloggiati.wskey} onChange={e => setAlloggiati(a => ({ ...a, wskey: e.target.value }))} />
          </Campo>
        </>)}

        {passo === 5 && (<>
          <h2 className="text-sm font-semibold text-gray-700">Tassa di soggiorno</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Campo label="Notti massime tassabili per soggiorno *" hint="Dal regolamento del Comune">
              <input className={inputCls} type="number" min={1} value={regole.tassa_max_notti} onChange={setR('tassa_max_notti')} />
            </Campo>
            <Campo label="Tariffa €/persona/notte" hint="Usata solo come riferimento">
              <input className={inputCls} type="number" min={0} step={0.5} value={regole.tassa_tariffa} onChange={setR('tassa_tariffa')} />
            </Campo>
          </div>
          <h2 className="text-sm font-semibold text-gray-700 pt-2">Costi di pulizia</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Campo label="Pulizia al check-out (€)">
              <input className={inputCls} type="number" min={0} value={regole.costo_pulizia_checkout} onChange={setR('costo_pulizia_checkout')} />
            </Campo>
            <Campo label="Cambio durante il soggiorno (€)">
              <input className={inputCls} type="number" min={0} value={regole.costo_cambio_stanza} onChange={setR('costo_cambio_stanza')} />
            </Campo>
          </div>
          <h2 className="text-sm font-semibold text-gray-700 pt-2">Modalità di incasso</h2>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TIPI_CONTO) as TipoContoCorrente[]).map(t => {
              const attivo = conti.some(c => c.tipo === t);
              return (
                <button key={t} type="button" onClick={() => toggleConto(t)}
                  className={`px-3 py-1.5 rounded-full text-sm border ${attivo ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'}`}>
                  {attivo && <Check size={13} className="inline mr-1" />}{TIPI_CONTO[t]}
                </button>
              );
            })}
          </div>
        </>)}

        {passo === 6 && (<>
          <p className="text-sm text-gray-600">
            Messaggio inviato all&apos;ospite con &quot;Invia istruzioni check-in&quot;. Completare le parti tra [ ] e usare i segnaposto:
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SEGNAPOSTO_ISTRUZIONI).map(([k, v]) => (
              <button key={k} type="button" title={v} onClick={() => setIstruzioni(t => `${t}${k}`)}
                className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-700 hover:bg-gray-200">{k}</button>
            ))}
          </div>
          <textarea className={`${inputCls} font-mono`} rows={14} value={istruzioni} onChange={e => setIstruzioni(e.target.value)} />
          {/\[[^\]]+\]/.test(istruzioni) && (
            <p className="text-xs text-amber-600">Ci sono ancora parti tra [ ] da completare.</p>
          )}
          <details className="text-sm">
            <summary className="cursor-pointer text-blue-700">Anteprima con dati di esempio</summary>
            <pre className="whitespace-pre-wrap bg-gray-50 rounded p-3 mt-2 text-xs text-gray-700">{anteprima}</pre>
          </details>
        </>)}

        {passo === 7 && (
          <dl className="text-sm divide-y divide-gray-100">
            {[
              ['Ragione sociale', fiscali.ragione_sociale],
              ['P.IVA / C.F.', [fiscali.partita_iva, fiscali.codice_fiscale].filter(Boolean).join(' · ')],
              ['Struttura', `${nome} — ${indirizzo}`],
              ['Tipologia', fiscali.tipologia || '—'],
              ['CIN / CIR', `${fiscali.cin || '—'} / ${fiscali.cir || '—'}`],
              ['Camere', camere.map(id => `${nomiCamere[id]?.trim() || `Camera ${id}`} €${prezziCamere[id] ?? 0}`).join(', ')],
              ['Calendari iCal', `${camere.filter(id => icalUrls[id]?.trim()).length} di ${numCamere} collegati`],
              ['Alloggiati Web', alloggiati.utente ? `utente ${alloggiati.utente}` : 'da configurare'],
              ['Tassa di soggiorno', `max ${regole.tassa_max_notti} notti${regole.tassa_tariffa ? `, €${regole.tassa_tariffa}/persona/notte` : ''}`],
              ['Pulizie', `€${regole.costo_pulizia_checkout} check-out, €${regole.costo_cambio_stanza} cambio`],
              ['Incassi', conti.map(c => c.nome).join(', ') || 'Contanti'],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[9rem_1fr] gap-3 py-2">
                <dt className="text-gray-500">{k}</dt><dd className="text-gray-800 break-words">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {errore && <p className="text-sm text-red-600">{errore}</p>}
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={() => { setErrore(''); setPasso(p => Math.max(0, p - 1)); }} disabled={passo === 0 || salvando}
          className="flex items-center gap-1 px-4 py-2 text-sm rounded border bg-white text-gray-700 disabled:opacity-40">
          <ChevronLeft size={16} /> Indietro
        </button>
        <button type="button" onClick={avanti} disabled={salvando}
          className="flex items-center gap-1 px-5 py-2 text-sm rounded bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60">
          {salvando && <Loader2 size={15} className="animate-spin" />}
          {passo === PASSI.length - 1 ? 'Conferma e inizia' : 'Salva e continua'}
          {passo < PASSI.length - 1 && <ChevronRight size={16} />}
        </button>
      </div>
    </div>
  );
}
