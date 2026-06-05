'use client';

import { useEffect, useState } from 'react';
import { Impostazioni, PrezzoPerPeriodo, ContoCorrente, TIPI_CONTO, TipoContoCorrente } from '@/lib/types';
import { useCamere } from '@/hooks/useCamere';
import { useStruttura } from '@/hooks/useStruttura';
import {
  Save, PenLine, Users, Trash2, Plus, KeyRound, Link, Copy, Check,
  RefreshCw, Table2, Palette, Download, Upload, ShieldAlert, Building2,
  Radio, Shield, Settings2, CalendarRange, MapPin, Mail, Loader2, Euro,
} from 'lucide-react';
import { invalidateNomeAppCache } from '@/hooks/useNomeApp';
import { PALETTE, COLOR_MAP, DEFAULT_COLOR_BY_ID, getCameraStyle, CameraColor } from '@/lib/camera-colors';

interface UtenteInfo { id: string; username: string; solo_calendario: boolean; }
interface SyncResult { camera_id: number; aggiunte: number; rimosse: number; errore?: string; }
interface ICalSyncResult {
  ok: boolean;
  risultati: SyncResult[];
  doppioniRimossi?: number;
  prenotazioniArricchite?: number;
  sheetsErrore?: string | null;
  sheetsConfigurato?: boolean;
  gmail?: { importate: number; aggiornate: number; cancellate: number; dettagli: string[] };
}

type MainTab = 'strutture' | 'camere' | 'account' | 'app' | 'sistema';
type SubTab = 'camere' | 'ical' | 'prezzi';
type CanalePrezzi = 'privato' | 'booking' | 'airbnb';

const DEFAULT_PERIODO = { camera_id: 1, nome_periodo: '', data_inizio: '', data_fine: '', prezzo_notte: '', prezzo_booking: '', prezzo_airbnb: '' };

export default function ImpostazioniPage() {
  const camere = useCamere();
  const { struttura: strutturaAttiva, strutture, setStruttura: setStrutturaAttiva } = useStruttura();

  const [sezione, setSezione] = useState<MainTab>('strutture');
  const [subTab, setSubTab] = useState<SubTab>('camere');

  // Impostazioni globali (Sheets, branding, iCal output)
  const [imp, setImp] = useState<Impostazioni>({ ical_urls: {}, nomi_camere: {}, prezzi_camere: {}, colori_camere: {}, num_camere: 5 });
  const [colori, setColori] = useState<Record<number, string>>({});
  const [numCamere, setNumCamere] = useState(5);

  // Edit struttura attiva (camere, ical, prezzi)
  const [editNomiCamere, setEditNomiCamere] = useState<Record<number, string>>({});
  const [editColoriCamere, setEditColoriCamere] = useState<Record<number, string>>({});
  const [editNumCamere, setEditNumCamere] = useState(5);
  const [editIcalUrls, setEditIcalUrls] = useState<Record<number, string>>({});
  const [salvatoEditCamere, setSalvatoEditCamere] = useState(false);
  const [salvatoEditIcal, setSalvatoEditIcal] = useState(false);

  // Inline editing dati struttura (nel tab Strutture)
  const [editingDatiId, setEditingDatiId] = useState<string | null>(null);
  const [editDatiNome, setEditDatiNome] = useState('');
  const [editDatiIndirizzo, setEditDatiIndirizzo] = useState('');
  const [salvatoEditDati, setSalvatoEditDati] = useState(false);

  // Prezzi periodi
  const [prezziPeriodi, setPrezziPeriodi] = useState<PrezzoPerPeriodo[]>([]);
  const [nuovoPeriodo, setNuovoPeriodo] = useState({ ...DEFAULT_PERIODO });
  const [salvatoPeriodo, setSalvatoPeriodo] = useState(false);
  const [canalePrezzi, setCanalePrezzi] = useState<CanalePrezzi>('privato');
  const [filtroPeriodo, setFiltroPeriodo] = useState<'corrente' | 'tutti'>('corrente');

  // Sync iCal
  const [syncingIcal, setSyncingIcal] = useState(false);
  const [risultatiIcal, setRisultatiIcal] = useState<ICalSyncResult | null>(null);

  // Sheets
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [msgSheets, setMsgSheets] = useState('');
  const [togglingSheets, setTogglingSheets] = useState(false);

  // iCal output
  const [copiato, setCopiato] = useState<number | null>(null);
  const [origin, setOrigin] = useState('');

  // Account
  const [utenti, setUtenti] = useState<UtenteInfo[]>([]);
  const [nuovoUsername, setNuovoUsername] = useState('');
  const [nuovaPassword, setNuovaPassword] = useState('');
  const [nuovoSoloCalendario, setNuovoSoloCalendario] = useState(true);
  const [erroreAccount, setErroreAccount] = useState('');
  const [cambioPasswordId, setCambioPasswordId] = useState<string | null>(null);
  const [nuovaPasswordCambio, setNuovaPasswordCambio] = useState('');

  // App branding
  const [nomeApp, setNomeApp] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [salvatoBranding, setSalvatoBranding] = useState(false);

  // Conti correnti (per struttura)
  const [editContiCorrenti, setEditContiCorrenti] = useState<ContoCorrente[]>([]);
  const [nuovoContoNome, setNuovoContoNome] = useState('');
  const [nuovoContoTipo, setNuovoContoTipo] = useState<TipoContoCorrente>('contanti');
  const [salvatoConti, setSalvatoConti] = useState(false);

  // AlloggiatiWeb credentials (per struttura)
  const [editAlloggiatiUtente, setEditAlloggiatiUtente] = useState('');
  const [editAlloggiatiPassword, setEditAlloggiatiPassword] = useState('');
  const [editAlloggiatiWskey, setEditAlloggiatiWskey] = useState('');
  const [mostraPasswordAlloggiati, setMostraPasswordAlloggiati] = useState(false);
  const [salvatoAlloggiati, setSalvatoAlloggiati] = useState(false);

  // Sistema backup
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [msgBackup, setMsgBackup] = useState('');


  // Gestisci strutture (in fondo al tab struttura)
  const [nuovaStrutturaForm, setNuovaStrutturaForm] = useState({ nome: '', indirizzo: '', num_camere: '5' });

  // Inizializza campi edit quando cambia la struttura attiva
  useEffect(() => {
    if (!strutturaAttiva) return;
    setEditNomiCamere(strutturaAttiva.nomi_camere ?? {});
    setEditColoriCamere(strutturaAttiva.colori_camere ?? {});
    setEditNumCamere(strutturaAttiva.num_camere ?? 5);
    setEditIcalUrls(strutturaAttiva.ical_urls ?? {});
    setNuovoPeriodo(p => ({ ...p, camera_id: 1 }));
  }, [strutturaAttiva?.id]);

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch('/api/impostazioni')
      .then(r => r.json())
      .then(data => {
        setImp(data);
        setColori(data.colori_camere ?? {});
        setNumCamere(data.num_camere ?? 5);
        setNomeApp(data.nome_app ?? '');
        setLogoUrl(data.logo_url ?? '');
      });
    caricaUtenti();
    caricaPrezziPeriodi();
  }, []);

  function caricaPrezziPeriodi() {
    fetch('/api/prezzi-periodi').then(r => r.json()).then(setPrezziPeriodi).catch(() => {});
  }

  function caricaStrutture() {
    fetch('/api/strutture').then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        // Aggiorna la struttura selezionata nei conti correnti se è quella corrente
        const aggiornata = data.find((s: { id: string }) => s.id === editingDatiId);
        if (aggiornata) {
          setEditContiCorrenti(aggiornata.conti_correnti?.length ? [...aggiornata.conti_correnti] : [{ id: 'contanti-default', tipo: 'contanti' as const, nome: 'Contanti' }]);
        }
      }
    }).catch(() => {});
  }

  async function salvaContiCorrenti(id: string) {
    await fetch(`/api/strutture/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conti_correnti: editContiCorrenti }),
    });
    setSalvatoConti(true);
    setTimeout(() => setSalvatoConti(false), 2000);
    caricaStrutture();
  }

  async function salvaCredenziali(id: string) {
    await fetch(`/api/strutture/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alloggiati_credentials: {
          utente: editAlloggiatiUtente.trim(),
          password: editAlloggiatiPassword,
          wskey: editAlloggiatiWskey.trim(),
        },
      }),
    });
    setSalvatoAlloggiati(true);
    setTimeout(() => setSalvatoAlloggiati(false), 2000);
  }

  async function salvaEditDati(id: string) {
    await fetch(`/api/strutture/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: editDatiNome.trim(), indirizzo: editDatiIndirizzo.trim() }),
    });
    setSalvatoEditDati(true);
    setTimeout(() => { setSalvatoEditDati(false); setEditingDatiId(null); }, 1500);
    caricaStrutture();
  }

  async function salvaEditCamere() {
    if (!strutturaAttiva) return;
    await fetch(`/api/strutture/${strutturaAttiva.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomi_camere: editNomiCamere, colori_camere: editColoriCamere, num_camere: editNumCamere }),
    });
    setSalvatoEditCamere(true);
    setTimeout(() => setSalvatoEditCamere(false), 2000);
  }

  async function salvaEditIcal() {
    if (!strutturaAttiva) return;
    await fetch(`/api/strutture/${strutturaAttiva.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ical_urls: editIcalUrls }),
    });
    setSalvatoEditIcal(true);
    setTimeout(() => setSalvatoEditIcal(false), 2000);
  }

  async function aggiungiPeriodo() {
    const { camera_id, nome_periodo, data_inizio, data_fine, prezzo_notte, prezzo_booking, prezzo_airbnb } = nuovoPeriodo;
    if (!data_inizio || !data_fine || !prezzo_notte) return;
    await fetch('/api/prezzi-periodi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        camera_id: Number(camera_id),
        nome_periodo,
        data_inizio,
        data_fine,
        prezzo_notte:   Number(prezzo_notte),
        prezzo_booking: prezzo_booking  ? Number(prezzo_booking)  : null,
        prezzo_airbnb:  prezzo_airbnb   ? Number(prezzo_airbnb)   : null,
      }),
    });
    setNuovoPeriodo({ ...DEFAULT_PERIODO });
    setSalvatoPeriodo(true);
    setTimeout(() => setSalvatoPeriodo(false), 2000);
    caricaPrezziPeriodi();
  }

  async function eliminaPeriodo(id: string) {
    await fetch(`/api/prezzi-periodi/${id}`, { method: 'DELETE' });
    caricaPrezziPeriodi();
  }

  async function creaNuovaStruttura() {
    const { nome, indirizzo, num_camere } = nuovaStrutturaForm;
    if (!nome.trim()) return;
    const res = await fetch('/api/strutture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: nome.trim(), indirizzo: indirizzo.trim(), num_camere: Number(num_camere) || 5 }),
    });
    const nuova = await res.json();
    setNuovaStrutturaForm({ nome: '', indirizzo: '', num_camere: '5' });
    setStrutturaAttiva(nuova.id);
    caricaStrutture();
  }

  async function eliminaStruttura(id: string) {
    if (!confirm('Eliminare questa struttura?')) return;
    await fetch(`/api/strutture/${id}`, { method: 'DELETE' });
    if (strutturaAttiva?.id === id && strutture.length > 1) {
      const altra = strutture.find(s => s.id !== id);
      if (altra) setStrutturaAttiva(altra.id);
    }
    caricaStrutture();
  }

  function caricaUtenti() {
    fetch('/api/auth/utenti').then(r => r.json()).then(setUtenti);
  }

  async function copia(cameraId: number) {
    await navigator.clipboard.writeText(`${origin}/api/ical/${cameraId}`);
    setCopiato(cameraId);
    setTimeout(() => setCopiato(null), 2000);
  }

  async function aggiungiUtente() {
    setErroreAccount('');
    const res = await fetch('/api/auth/utenti', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: nuovoUsername, password: nuovaPassword, solo_calendario: nuovoSoloCalendario }),
    });
    if (res.ok) { setNuovoUsername(''); setNuovaPassword(''); setNuovoSoloCalendario(true); caricaUtenti(); }
    else { const d = await res.json(); setErroreAccount(d.error); }
  }

  async function toggleSoloCalendario(id: string, valore: boolean) {
    await fetch(`/api/auth/utenti/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ solo_calendario: valore }) });
    caricaUtenti();
  }

  async function eliminaUtente(id: string) {
    if (!confirm('Eliminare questo utente?')) return;
    await fetch(`/api/auth/utenti/${id}`, { method: 'DELETE' });
    caricaUtenti();
  }

  async function cambiaPassword(id: string) {
    await fetch(`/api/auth/utenti/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: nuovaPasswordCambio }) });
    setCambioPasswordId(null);
    setNuovaPasswordCambio('');
  }

  async function toggleGoogleSheets() {
    setTogglingSheets(true);
    const nuovo = !(imp.google_sheets_abilitato ?? false);
    await fetch('/api/impostazioni', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ google_sheets_abilitato: nuovo }) });
    setImp(prev => ({ ...prev, google_sheets_abilitato: nuovo }));
    setTogglingSheets(false);
  }

  async function salvaBranding() {
    await fetch('/api/impostazioni', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome_app: nomeApp.trim() || 'Affitti Brevi', logo_url: logoUrl.trim() || '/logo.svg' }),
    });
    invalidateNomeAppCache();
    setSalvatoBranding(true);
    setTimeout(() => setSalvatoBranding(false), 2000);
  }

  async function sincronizzaIcal() {
    setSyncingIcal(true);
    setRisultatiIcal(null);
    const res = await fetch('/api/sync', { method: 'POST' });
    setRisultatiIcal(await res.json());
    setSyncingIcal(false);
  }

  async function syncSheets(direzione: 'export' | 'import') {
    setSyncingSheets(true);
    setMsgSheets('');
    const res = await fetch('/api/sync-sheets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ direzione }) });
    const data = await res.json();
    setMsgSheets(data.messaggio ?? data.errore ?? 'Fatto');
    setSyncingSheets(false);
  }

  async function scaricaBackup() {
    setBackupLoading(true);
    try {
      const res = await fetch('/api/backup');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-affitti-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setBackupLoading(false); }
  }

  async function ripristinaBackup(file: File) {
    if (!confirm(`ATTENZIONE: questa operazione sovrascrive TUTTI i dati con il backup "${file.name}".\n\nProcedere?`)) return;
    setRestoreLoading(true);
    setMsgBackup('');
    try {
      const json = JSON.parse(await file.text());
      const res = await fetch('/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json) });
      const data = await res.json();
      setMsgBackup(data.messaggio ?? data.errore ?? 'Fatto');
    } catch { setMsgBackup('Errore: file non valido o corrotto'); }
    finally { setRestoreLoading(false); }
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const idsEditCamere = Array.from({ length: editNumCamere }, (_, i) => i + 1);
  const idsCamereOutput = Array.from({ length: numCamere }, (_, i) => i + 1);
  const periodiAttiva = prezziPeriodi.filter(p => p.struttura_id === strutturaAttiva?.id);
  const oggi = new Date().toISOString().slice(0, 10);
  const periodiVisibili = filtroPeriodo === 'corrente'
    ? periodiAttiva.filter(p => p.data_inizio <= oggi && p.data_fine >= oggi)
    : periodiAttiva;
  const hasPeriodoCorrente = periodiAttiva.some(p => p.data_inizio <= oggi && p.data_fine >= oggi);

  const TAB = [
    { id: 'strutture', label: 'Strutture', icon: Building2, color: 'slate'  },
    { id: 'camere',    label: 'Camere',    icon: PenLine,   color: 'purple' },
    { id: 'account',   label: 'Account',   icon: Shield,    color: 'indigo' },
    { id: 'app',       label: 'App',       icon: Palette,   color: 'teal'   },
    { id: 'sistema',   label: 'Sistema',   icon: Settings2, color: 'orange' },
  ] as const;

  const tabColor: Record<string, string> = {
    slate:  'border-slate-600  text-slate-700  bg-slate-50',
    purple: 'border-purple-600 text-purple-700 bg-purple-50',
    blue:   'border-blue-600   text-blue-700   bg-blue-50',
    indigo: 'border-indigo-600 text-indigo-700 bg-indigo-50',
    teal:   'border-teal-600   text-teal-700   bg-teal-50',
    orange: 'border-orange-500 text-orange-700 bg-orange-50',
  };
  const tabInactive = 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50';

  const SUB_TABS: { id: SubTab; label: string }[] = [
    { id: 'camere', label: 'Camere' },
    { id: 'prezzi', label: 'Prezzi' },
    { id: 'ical',   label: 'iCal'   },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Impostazioni</h1>

      {/* Tab principali */}
      <div className="flex border-b border-gray-200 gap-1 -mb-2 sticky top-0 bg-white z-10 pt-1 overflow-x-auto">
        {TAB.map(t => {
          const Icon = t.icon;
          const active = sezione === t.id;
          return (
            <button key={t.id} onClick={() => setSezione(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors rounded-t whitespace-nowrap ${active ? tabColor[t.color] : tabInactive}`}
            >
              <Icon size={15} />
              {t.label}
              {t.id === 'sistema' && <span className="ml-1 text-[10px] bg-gray-200 text-gray-500 rounded px-1">globale</span>}
            </button>
          );
        })}
      </div>

      {/* ── CAMERE ────────────────────────────────────────────────────── */}
      {sezione === 'camere' && (
        <>
          {!strutturaAttiva ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-400 text-sm">
              Nessuna struttura selezionata
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Intestazione struttura attiva */}
              <div className="px-5 py-4 border-b bg-purple-50 flex items-center gap-2">
                <Building2 size={16} className="text-purple-600" />
                <span className="font-semibold text-purple-800">{strutturaAttiva.nome}</span>
                {strutturaAttiva.indirizzo && <span className="text-xs text-purple-500">— {strutturaAttiva.indirizzo}</span>}
              </div>

              {/* Sub-tab bar */}
              <div className="flex border-b border-gray-100 bg-gray-50 px-5 gap-0.5 pt-2">
                {SUB_TABS.map(st => (
                  <button key={st.id} onClick={() => setSubTab(st.id)}
                    className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors rounded-t -mb-px ${
                      subTab === st.id
                        ? 'border-purple-600 text-purple-700 bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <div className="px-5 py-5">

                {/* Sub-tab: CAMERE */}
                {subTab === 'camere' && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <PenLine size={16} className="text-purple-600" />
                      <h3 className="font-semibold text-gray-700 text-sm">Camere</h3>
                    </div>
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wide pb-1 border-b">
                        <span className="w-20 flex-shrink-0">ID</span>
                        <span className="flex-1">Nome</span>
                        <span>Colore</span>
                      </div>
                      {idsEditCamere.map(id => {
                        const coloreAttuale = (editColoriCamere[id] as CameraColor | undefined) ?? DEFAULT_COLOR_BY_ID[id] ?? 'gray';
                        return (
                          <div key={id} className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 w-20 flex-shrink-0">
                              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getCameraStyle(id, editColoriCamere[id]).dot}`} />
                              <span className="text-sm text-gray-400">Cam {id}</span>
                            </div>
                            <input type="text" placeholder={`Camera ${id}`} value={editNomiCamere[id] ?? ''}
                              onChange={e => setEditNomiCamere(prev => ({ ...prev, [id]: e.target.value }))}
                              className="flex-1 border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
                            />
                            <div className="flex items-center gap-0.5 flex-wrap">
                              {PALETTE.map(c => (
                                <button key={c} type="button"
                                  onClick={() => setEditColoriCamere(prev => ({ ...prev, [id]: c }))}
                                  className={`w-5 h-5 rounded-full ${COLOR_MAP[c].dot} flex-shrink-0 border-2 transition-transform ${
                                    coloreAttuale === c ? 'border-gray-700 scale-110' : 'border-transparent hover:scale-105'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={salvaEditCamere}
                        className="flex items-center gap-1.5 bg-purple-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-purple-700"
                      >
                        <Save size={14} />
                        {salvatoEditCamere ? 'Salvato!' : 'Salva camere'}
                      </button>
                      <button onClick={() => setEditNumCamere(n => n + 1)}
                        className="flex items-center gap-1 border border-purple-300 text-purple-700 px-2 py-1.5 rounded text-sm hover:bg-purple-50"
                      >
                        <Plus size={14} /> Aggiungi
                      </button>
                      <button onClick={() => setEditNumCamere(n => Math.max(1, n - 1))} disabled={editNumCamere <= 1}
                        className="flex items-center gap-1 border border-gray-300 text-gray-500 px-2 py-1.5 rounded text-sm hover:bg-gray-50 disabled:opacity-40"
                      >
                        <Trash2 size={14} /> Rimuovi ultima
                      </button>
                    </div>
                  </div>
                )}

                {/* Sub-tab: ICAL */}
                {subTab === 'ical' && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Link size={16} className="text-blue-600" />
                      <h3 className="font-semibold text-gray-700 text-sm">URL iCal Booking.com</h3>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">
                      Incolla gli URL iCal di importazione da Booking.com per ogni camera.
                    </p>
                    <div className="space-y-2 mb-3">
                      {idsEditCamere.map(id => (
                        <div key={id} className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
                            <div className={`w-2 h-2 rounded-full ${getCameraStyle(id, editColoriCamere[id]).dot}`} />
                            <span className="text-xs text-gray-500 truncate">{editNomiCamere[id] || `Cam ${id}`}</span>
                          </div>
                          <input type="url" placeholder="https://ical.booking.com/v1/exportiCalendar?..."
                            value={editIcalUrls[id] ?? ''}
                            onChange={e => setEditIcalUrls(prev => ({ ...prev, [id]: e.target.value }))}
                            className="flex-1 border rounded px-3 py-1.5 text-xs font-mono text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                      ))}
                    </div>
                    <button onClick={salvaEditIcal}
                      className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
                    >
                      <Save size={14} />
                      {salvatoEditIcal ? 'Salvato!' : 'Salva URL iCal'}
                    </button>

                    {/* Sync iCal */}
                    <div className="border-t pt-5 mt-5">
                      <div className="flex items-center gap-2 mb-3">
                        <RefreshCw size={16} className="text-blue-600" />
                        <h3 className="font-semibold text-gray-700 text-sm">Sincronizzazione iCal</h3>
                      </div>
                      <p className="text-xs text-gray-400 mb-3">
                        Sincronizza le prenotazioni dalla struttura attiva tramite gli URL iCal configurati nel tab iCal.
                      </p>
                      <button onClick={sincronizzaIcal} disabled={syncingIcal}
                        className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                      >
                        <RefreshCw size={15} className={syncingIcal ? 'animate-spin' : ''} />
                        {syncingIcal ? 'Sincronizzando...' : 'Sync iCal ora'}
                      </button>
                      {risultatiIcal && (
                        <div className="mt-3 space-y-1">
                          {risultatiIcal.risultati.map(r => {
                            const cam = camere.find(c => c.id === r.camera_id);
                            return (
                              <div key={r.camera_id} className={`text-xs px-3 py-1.5 rounded flex items-center gap-2 ${r.errore ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getCameraStyle(r.camera_id, colori[r.camera_id]).dot}`} />
                                <span>{cam?.nome ?? `Camera ${r.camera_id}`}:</span>
                                {r.errore ? <span>{r.errore}</span> : <span>+{r.aggiunte} aggiunte, -{r.rimosse} rimosse</span>}
                              </div>
                            );
                          })}
                          {(risultatiIcal.doppioniRimossi ?? 0) > 0 && (
                            <div className="text-xs px-3 py-1 text-gray-500">{risultatiIcal.doppioniRimossi} doppio/i rimosso/i</div>
                          )}
                          {risultatiIcal.sheetsErrore && (
                            <div className="text-xs px-3 py-1.5 rounded bg-red-50 text-red-700">Sheets: {risultatiIcal.sheetsErrore}</div>
                          )}
                          {!risultatiIcal.sheetsErrore && risultatiIcal.sheetsConfigurato && (
                            <div className={`text-xs px-3 py-1.5 rounded ${(risultatiIcal.prenotazioniArricchite ?? 0) > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-500'}`}>
                              Sheets: {risultatiIcal.prenotazioniArricchite ?? 0} prenotazioni aggiornate
                            </div>
                          )}
                          {risultatiIcal.gmail && (risultatiIcal.gmail.importate > 0 || risultatiIcal.gmail.aggiornate > 0) && (
                            <div className="text-xs px-3 py-1.5 rounded bg-blue-50 text-blue-700">
                              Gmail: {[risultatiIcal.gmail.importate > 0 && `${risultatiIcal.gmail.importate} nuove`, risultatiIcal.gmail.aggiornate > 0 && `${risultatiIcal.gmail.aggiornate} aggiornate`].filter(Boolean).join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* iCal Output */}
                    <div className="border-t pt-5 mt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Link size={16} className="text-green-600" />
                        <h3 className="font-semibold text-gray-700 text-sm">iCal Output — Blocca date su Booking.com</h3>
                      </div>
                      <p className="text-xs text-gray-400 mb-3">Extranet → Proprietà → Disponibilità → Sincronizzazione calendario → Importa calendario</p>
                      <div className="space-y-2">
                        {idsCamereOutput.map(id => {
                          const nomeAttuale = camere.find(c => c.id === id)?.nome || `Camera ${id}`;
                          const url = origin ? `${origin}/api/ical/${id}` : `…/api/ical/${id}`;
                          return (
                            <div key={id} className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getCameraStyle(id, colori[id]).dot}`} />
                                <span className="text-sm text-gray-600 truncate">{nomeAttuale}</span>
                              </div>
                              <code className="flex-1 text-xs bg-gray-50 border rounded px-3 py-2 text-gray-600 truncate">{url}</code>
                              <button onClick={() => copia(id)} title="Copia URL"
                                className={`flex items-center gap-1 px-2 py-2 rounded text-xs font-medium transition-colors flex-shrink-0 ${copiato === id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                              >
                                {copiato === id ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-tab: PREZZI */}
                {subTab === 'prezzi' && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CalendarRange size={16} className="text-green-600" />
                      <h3 className="font-semibold text-gray-700 text-sm">Prezzi per periodo</h3>
                    </div>

                    {/* Filtri: periodo + canale */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                        <button onClick={() => setFiltroPeriodo('corrente')}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                            filtroPeriodo === 'corrente' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          Periodo corrente
                        </button>
                        <button onClick={() => setFiltroPeriodo('tutti')}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                            filtroPeriodo === 'tutti' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          Tutti
                        </button>
                      </div>
                      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                        {([['privato', 'Privato'], ['booking', 'Booking'], ['airbnb', 'Airbnb']] as [CanalePrezzi, string][]).map(([id, label]) => (
                          <button key={id} onClick={() => setCanalePrezzi(id)}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                              canalePrezzi === id ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {filtroPeriodo === 'corrente' && !hasPeriodoCorrente && periodiAttiva.length > 0 && (
                      <p className="text-xs text-amber-600 bg-amber-50 rounded px-3 py-2 mb-3">
                        Nessun periodo attivo oggi. Mostra tutti i periodi.
                      </p>
                    )}

                    {idsEditCamere.map(id => {
                      const nomeCamera = editNomiCamere[id] || `Camera ${id}`;
                      const periodiCamera = (filtroPeriodo === 'corrente' && !hasPeriodoCorrente ? periodiAttiva : periodiVisibili)
                        .filter(p => p.camera_id === id);
                      if (periodiCamera.length === 0) return null;
                      return (
                        <div key={id} className="mb-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className={`w-2 h-2 rounded-full ${getCameraStyle(id, editColoriCamere[id]).dot}`} />
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{nomeCamera}</span>
                          </div>
                          <div className="space-y-1">
                            {periodiCamera.map(p => {
                              const prezzoCanale = canalePrezzi === 'booking'
                                ? (p.prezzo_booking ?? p.prezzo_notte)
                                : canalePrezzi === 'airbnb'
                                  ? (p.prezzo_airbnb ?? p.prezzo_notte)
                                  : p.prezzo_notte;
                              const isDefault = canalePrezzi !== 'privato' && (
                                (canalePrezzi === 'booking' && p.prezzo_booking == null) ||
                                (canalePrezzi === 'airbnb'  && p.prezzo_airbnb  == null)
                              );
                              const isAttivo = p.data_inizio <= oggi && p.data_fine >= oggi;
                              return (
                                <div key={p.id} className={`flex items-center gap-2 text-xs rounded px-3 py-1.5 ${isAttivo ? 'bg-green-50 ring-1 ring-green-200' : 'bg-gray-50'}`}>
                                  <span className="font-medium text-gray-700 w-24 truncate">{p.nome_periodo || '—'}</span>
                                  <span className="text-gray-400">{p.data_inizio} → {p.data_fine}</span>
                                  {isAttivo && <span className="text-[10px] bg-green-100 text-green-700 rounded px-1 font-medium">oggi</span>}
                                  <span className={`ml-auto font-semibold ${isDefault ? 'text-gray-400' : 'text-green-700'}`}>
                                    €{prezzoCanale}/notte{isDefault ? ' (=priv.)' : ''}
                                  </span>
                                  <button onClick={() => eliminaPeriodo(p.id)} className="ml-1 text-gray-400 hover:text-red-500">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {periodiAttiva.length === 0 && <p className="text-xs text-gray-400 mb-3">Nessun periodo configurato.</p>}

                    <div className="border-t pt-4 mt-2">
                      <p className="text-xs font-medium text-gray-500 mb-3">Aggiungi periodo</p>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Camera</label>
                          <select value={nuovoPeriodo.camera_id}
                            onChange={e => setNuovoPeriodo(p => ({ ...p, camera_id: Number(e.target.value) }))}
                            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                          >
                            {idsEditCamere.map(id => <option key={id} value={id}>{editNomiCamere[id] || `Camera ${id}`}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Nome periodo</label>
                          <input type="text" placeholder="es. Alta stagione" value={nuovoPeriodo.nome_periodo}
                            onChange={e => setNuovoPeriodo(p => ({ ...p, nome_periodo: e.target.value }))}
                            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Data inizio</label>
                          <input type="date" value={nuovoPeriodo.data_inizio}
                            onChange={e => setNuovoPeriodo(p => ({ ...p, data_inizio: e.target.value }))}
                            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Data fine</label>
                          <input type="date" value={nuovoPeriodo.data_fine}
                            onChange={e => setNuovoPeriodo(p => ({ ...p, data_fine: e.target.value }))}
                            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                          />
                        </div>
                      </div>
                      {/* Prezzi per canale */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Privato (€/notte) *</label>
                          <input type="number" min="0" step="0.01" placeholder="es. 90" value={nuovoPeriodo.prezzo_notte}
                            onChange={e => setNuovoPeriodo(p => ({ ...p, prezzo_notte: e.target.value }))}
                            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Booking (€/notte)</label>
                          <input type="number" min="0" step="0.01" placeholder="vuoto = privato" value={nuovoPeriodo.prezzo_booking}
                            onChange={e => setNuovoPeriodo(p => ({ ...p, prezzo_booking: e.target.value }))}
                            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Airbnb (€/notte)</label>
                          <input type="number" min="0" step="0.01" placeholder="vuoto = privato" value={nuovoPeriodo.prezzo_airbnb}
                            onChange={e => setNuovoPeriodo(p => ({ ...p, prezzo_airbnb: e.target.value }))}
                            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-pink-400"
                          />
                        </div>
                      </div>
                      <button onClick={aggiungiPeriodo}
                        disabled={!nuovoPeriodo.data_inizio || !nuovoPeriodo.data_fine || !nuovoPeriodo.prezzo_notte}
                        className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-40"
                      >
                        {salvatoPeriodo ? <Check size={14} /> : <Plus size={14} />}
                        {salvatoPeriodo ? 'Aggiunto!' : 'Aggiungi periodo'}
                      </button>
                    </div>
                  </div>
                )}


              </div>
            </div>
          )}
        </>
      )}

      {/* ── STRUTTURE ─────────────────────────────────────────────────── */}
      {sezione === 'strutture' && (() => {
        const selezionata = strutture.find(s => s.id === editingDatiId) ?? null;
        function seleziona(s: typeof strutture[0]) {
          setEditingDatiId(s.id);
          setEditDatiNome(s.nome);
          setEditDatiIndirizzo(s.indirizzo ?? '');
          setSalvatoEditDati(false);
          setEditAlloggiatiUtente(s.alloggiati_credentials?.utente ?? '');
          setEditAlloggiatiPassword(s.alloggiati_credentials?.password ?? '');
          setEditAlloggiatiWskey(s.alloggiati_credentials?.wskey ?? '');
          setMostraPasswordAlloggiati(false);
          setSalvatoAlloggiati(false);
          setEditContiCorrenti(s.conti_correnti?.length ? [...s.conti_correnti] : [{ id: 'contanti-default', tipo: 'contanti' as const, nome: 'Contanti' }]);
          setNuovoContoNome('');
          setNuovoContoTipo('contanti');
          setSalvatoConti(false);
        }
        return (
          <div className="space-y-4">

            {/* Lista strutture */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-slate-50">
                <Building2 size={15} className="text-slate-600" />
                <span className="font-semibold text-slate-700 text-sm">Le tue strutture</span>
              </div>
              <div className="divide-y divide-gray-100">
                {strutture.map(s => {
                  const isSelezionata = s.id === editingDatiId;
                  const isAttiva = s.id === strutturaAttiva?.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => seleziona(s)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                        isSelezionata ? 'bg-slate-700 text-white' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 size={14} className={isSelezionata ? 'text-slate-300' : 'text-slate-400'} />
                        <div className="min-w-0">
                          <span className={`text-sm font-medium truncate block ${isSelezionata ? 'text-white' : 'text-gray-800'}`}>{s.nome}</span>
                          {s.indirizzo && <span className={`text-xs truncate block ${isSelezionata ? 'text-slate-300' : 'text-gray-400'}`}>{s.indirizzo}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {isAttiva && (
                          <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${isSelezionata ? 'bg-slate-500 text-slate-200' : 'bg-purple-100 text-purple-600'}`}>
                            attiva
                          </span>
                        )}
                        {strutture.length > 1 && (
                          <span
                            role="button"
                            onClick={e => { e.stopPropagation(); eliminaStruttura(s.id); }}
                            className={`p-0.5 rounded ${isSelezionata ? 'text-slate-400 hover:text-red-300' : 'text-gray-300 hover:text-red-500'}`}
                          >
                            <Trash2 size={13} />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dettaglio struttura selezionata */}
            {selezionata && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-700 text-white">
                  <div className="flex items-center gap-2">
                    <Building2 size={15} />
                    <span className="font-semibold text-sm">{selezionata.nome}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selezionata.id !== strutturaAttiva?.id && (
                      <button
                        onClick={() => { setStrutturaAttiva(selezionata.id); setSezione('camere'); }}
                        className="text-xs bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded transition-colors"
                      >
                        Usa questa struttura
                      </button>
                    )}
                  </div>
                </div>

                <div className="px-5 py-4 space-y-2">
                  {/* Nome e indirizzo */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Nome</label>
                      <input type="text" value={editDatiNome} onChange={e => setEditDatiNome(e.target.value)}
                        className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Indirizzo</label>
                      <input type="text" value={editDatiIndirizzo} onChange={e => setEditDatiIndirizzo(e.target.value)}
                        className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                      />
                    </div>
                  </div>
                  <button onClick={() => salvaEditDati(selezionata.id)} disabled={!editDatiNome.trim()}
                    className="flex items-center gap-1.5 bg-slate-700 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-slate-800 disabled:opacity-40"
                  >
                    <Save size={13} />
                    {salvatoEditDati ? 'Salvato!' : 'Salva nome/indirizzo'}
                  </button>

                  {/* Conti correnti */}
                  <div className="border-t pt-4 mt-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Euro size={14} className="text-emerald-600" />
                      <span className="font-semibold text-gray-700 text-xs">Conti correnti / Modalità pagamento</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">Cassa, POS, conti bancari. Appaiono come scelta nella Prima Nota.</p>
                    <div className="space-y-1 mb-2">
                      {editContiCorrenti.map((c, idx) => (
                        <div key={c.id} className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1.5">
                          <span className="text-xs text-gray-500 w-16 shrink-0">{TIPI_CONTO[c.tipo]}</span>
                          <span className="text-xs font-medium text-gray-700 flex-1">{c.nome}</span>
                          {editContiCorrenti.length > 1 && (
                            <button type="button" onClick={() => setEditContiCorrenti(prev => prev.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1 mb-2">
                      <select value={nuovoContoTipo} onChange={e => setNuovoContoTipo(e.target.value as TipoContoCorrente)}
                        className="border rounded px-2 py-1 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      >
                        {(Object.entries(TIPI_CONTO) as [TipoContoCorrente, string][]).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <input type="text" placeholder="Nome (es. Cassa, POS Visa…)" value={nuovoContoNome}
                        onChange={e => setNuovoContoNome(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && nuovoContoNome.trim()) { e.preventDefault(); setEditContiCorrenti(prev => [...prev, { id: crypto.randomUUID(), tipo: nuovoContoTipo, nome: nuovoContoNome.trim() }]); setNuovoContoNome(''); }}}
                        className="flex-1 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                      <button type="button" disabled={!nuovoContoNome.trim()}
                        onClick={() => { setEditContiCorrenti(prev => [...prev, { id: crypto.randomUUID(), tipo: nuovoContoTipo, nome: nuovoContoNome.trim() }]); setNuovoContoNome(''); }}
                        className="flex items-center gap-1 bg-emerald-600 text-white px-2 py-1 rounded text-xs hover:bg-emerald-700 disabled:opacity-40"
                      >
                        <Plus size={11} /> Aggiungi
                      </button>
                    </div>
                    <button onClick={() => salvaContiCorrenti(selezionata.id)}
                      className="flex items-center gap-1.5 bg-emerald-600 text-white px-2.5 py-1.5 rounded text-xs font-medium hover:bg-emerald-700"
                    >
                      <Save size={12} />
                      {salvatoConti ? 'Salvato!' : 'Salva modalità pagamento'}
                    </button>
                  </div>

                  {/* Google Sheets */}
                  <div className="border-t pt-4 mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Table2 size={14} className="text-emerald-600" />
                        <span className="font-semibold text-gray-700 text-xs">Google Sheets</span>
                      </div>
                      <button onClick={toggleGoogleSheets} disabled={togglingSheets}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${imp.google_sheets_abilitato ? 'bg-emerald-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${imp.google_sheets_abilitato ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{imp.google_sheets_abilitato ? 'Integrazione attiva.' : 'Integrazione disabilitata.'}</p>
                    {imp.google_sheets_abilitato && (
                      <>
                        <div className="mb-2">
                          <div className="flex gap-2">
                            <input type="text" placeholder="URL o ID Foglio Google" defaultValue={imp.google_sheet_id ?? ''} id="sheet-url-input"
                              className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                            />
                            <button onClick={async () => {
                              const raw = (document.getElementById('sheet-url-input') as HTMLInputElement).value.trim();
                              const match = raw.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/) ?? raw.match(/^([a-zA-Z0-9_-]{20,})$/);
                              const sheetId = match?.[1] ?? raw;
                              if (!sheetId) return;
                              await fetch('/api/impostazioni', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ google_sheet_id: sheetId }) });
                              setImp(prev => ({ ...prev, google_sheet_id: sheetId }));
                            }} className="bg-emerald-600 text-white px-2.5 py-1.5 rounded text-xs font-medium hover:bg-emerald-700">Salva</button>
                          </div>
                          {imp.google_sheet_id && (
                            <a href={`https://docs.google.com/spreadsheets/d/${imp.google_sheet_id}/edit`} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-emerald-600 hover:underline mt-1 inline-block">Apri foglio →</a>
                          )}
                        </div>
                        <button onClick={() => syncSheets('export')} disabled={syncingSheets}
                          className="flex items-center gap-1.5 bg-emerald-600 text-white px-2.5 py-1.5 rounded text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <RefreshCw size={12} className={syncingSheets ? 'animate-spin' : ''} />
                          Esporta su Sheets
                        </button>
                        {msgSheets && (
                          <div className={`mt-2 text-xs px-3 py-2 rounded ${msgSheets.includes('rrore') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{msgSheets}</div>
                        )}
                      </>
                    )}
                  </div>

                  {/* AlloggiatiWeb */}
                  <div className="border-t pt-4 mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield size={14} className="text-blue-600" />
                      <span className="font-semibold text-gray-700 text-xs">AlloggiatiWeb</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">Credenziali per l&apos;invio automatico al portale Polizia di Stato.</p>
                    <div className="space-y-2 mb-2">
                      <input type="text" placeholder="Utente" value={editAlloggiatiUtente} onChange={e => setEditAlloggiatiUtente(e.target.value)}
                        autoComplete="off" className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                      <div className="flex gap-1">
                        <input type={mostraPasswordAlloggiati ? 'text' : 'password'} placeholder="Password"
                          value={editAlloggiatiPassword} onChange={e => setEditAlloggiatiPassword(e.target.value)}
                          autoComplete="new-password" className="flex-1 border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <button type="button" onClick={() => setMostraPasswordAlloggiati(p => !p)} className="border rounded px-2 text-xs text-gray-500 hover:bg-gray-50">
                          {mostraPasswordAlloggiati ? 'Nascondi' : 'Mostra'}
                        </button>
                      </div>
                      <input type="text" placeholder="WsKey" value={editAlloggiatiWskey} onChange={e => setEditAlloggiatiWskey(e.target.value)}
                        autoComplete="off" className="w-full border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                    <button onClick={() => salvaCredenziali(selezionata.id)}
                      disabled={!editAlloggiatiUtente || !editAlloggiatiPassword || !editAlloggiatiWskey}
                      className="flex items-center gap-1.5 bg-blue-600 text-white px-2.5 py-1.5 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-40"
                    >
                      <Save size={12} />
                      {salvatoAlloggiati ? 'Salvato!' : 'Salva credenziali'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Aggiungi struttura */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-xs font-medium text-gray-500 mb-3">Aggiungi struttura</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="col-span-2">
                  <input type="text" placeholder="Nome struttura" value={nuovaStrutturaForm.nome}
                    onChange={e => setNuovaStrutturaForm(f => ({ ...f, nome: e.target.value }))}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <input type="text" placeholder="Indirizzo (opzionale)" value={nuovaStrutturaForm.indirizzo}
                    onChange={e => setNuovaStrutturaForm(f => ({ ...f, indirizzo: e.target.value }))}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <input type="number" min="1" max="20" placeholder="N° camere" value={nuovaStrutturaForm.num_camere}
                    onChange={e => setNuovaStrutturaForm(f => ({ ...f, num_camere: e.target.value }))}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
              </div>
              <button onClick={creaNuovaStruttura} disabled={!nuovaStrutturaForm.nome.trim()}
                className="flex items-center gap-1.5 bg-slate-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-slate-800 disabled:opacity-40"
              >
                <Plus size={15} /> Crea struttura
              </button>
            </div>

          </div>
        );
      })()}

      {/* ── ACCOUNT ─────────────────────────────────────────────────── */}
      {sezione === 'account' && (
        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Users size={18} className="text-indigo-600" />
            <h2 className="font-semibold text-gray-700">Gestione account</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">Utenti autorizzati ad accedere all&apos;applicazione.</p>
          <div className="space-y-2 mb-5">
            {utenti.map(u => (
              <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 bg-gray-50">
                <span className="flex-1 text-sm font-medium text-gray-800">{u.username}</span>
                <button onClick={() => toggleSoloCalendario(u.id, !u.solo_calendario)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${u.solo_calendario ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100' : 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'}`}
                >
                  {u.solo_calendario ? '📅 Solo cal.' : '✓ Completo'}
                </button>
                {cambioPasswordId === u.id ? (
                  <div className="flex items-center gap-2">
                    <input type="password" placeholder="Nuova password" value={nuovaPasswordCambio}
                      onChange={e => setNuovaPasswordCambio(e.target.value)}
                      className="border rounded px-2 py-1 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    <button onClick={() => cambiaPassword(u.id)} disabled={!nuovaPasswordCambio}
                      className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 disabled:opacity-40"
                    >Salva</button>
                    <button onClick={() => { setCambioPasswordId(null); setNuovaPasswordCambio(''); }} className="text-xs text-gray-400 hover:text-gray-600">Annulla</button>
                  </div>
                ) : (
                  <button onClick={() => setCambioPasswordId(u.id)} title="Cambia password" className="text-gray-400 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50">
                    <KeyRound size={15} />
                  </button>
                )}
                <button onClick={() => eliminaUtente(u.id)} title="Elimina" className="text-gray-300 hover:text-red-600 p-1 rounded hover:bg-red-50">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <div className="border-t pt-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Aggiungi utente</div>
            <div className="flex items-center gap-2 flex-wrap">
              <input type="text" placeholder="Username" value={nuovoUsername} onChange={e => setNuovoUsername(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <input type="password" placeholder="Password" value={nuovaPassword} onChange={e => setNuovaPassword(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={nuovoSoloCalendario} onChange={e => setNuovoSoloCalendario(e.target.checked)} className="accent-amber-500" />
                Solo calendario
              </label>
              <button onClick={aggiungiUtente} disabled={!nuovoUsername || !nuovaPassword}
                className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
              >
                <Plus size={14} /> Aggiungi
              </button>
            </div>
            {erroreAccount && <p className="text-xs text-red-600 mt-2">{erroreAccount}</p>}
          </div>
        </div>
      )}

      {/* ── APP ─────────────────────────────────────────────────────── */}
      {sezione === 'app' && (
        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Palette size={18} className="text-blue-600" />
            <h2 className="font-semibold text-gray-700">Identità app</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">Personalizza il nome e il logo nella barra di navigazione e nella schermata di accesso.</p>
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome applicazione</label>
              <input type="text" placeholder="Affitti Brevi" value={nomeApp} onChange={e => setNomeApp(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">URL logo</label>
              <input type="text" placeholder="/logo.svg  oppure  https://..." value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <p className="text-[11px] text-gray-400 mt-1">Percorso relativo (/logo.svg) o URL assoluto di un&apos;immagine pubblica.</p>
            </div>
          </div>
          <button onClick={salvaBranding}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
          >
            <Save size={15} />
            {salvatoBranding ? 'Salvato!' : 'Salva identità'}
          </button>

        </div>
      )}

      {/* ── SISTEMA (globale) ────────────────────────────────────────── */}
      {sezione === 'sistema' && (
        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert size={18} className="text-orange-500" />
            <h2 className="font-semibold text-gray-700">Backup e ripristino</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Backup completo di tutte le strutture — prenotazioni, uscite, entrate.
          </p>
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <button onClick={scaricaBackup} disabled={backupLoading}
              className="flex items-center gap-1.5 bg-orange-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
            >
              <Download size={15} className={backupLoading ? 'animate-bounce' : ''} />
              {backupLoading ? 'Download...' : 'Scarica backup'}
            </button>
            <label className={`flex items-center gap-1.5 border border-orange-300 text-orange-700 bg-orange-50 px-4 py-2 rounded text-sm font-medium cursor-pointer hover:bg-orange-100 ${restoreLoading ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload size={15} />
              {restoreLoading ? 'Ripristino...' : 'Ripristina da backup'}
              <input type="file" accept=".json" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { ripristinaBackup(f); e.target.value = ''; } }}
              />
            </label>
          </div>
          {msgBackup && (
            <div className={`text-sm px-3 py-2 rounded ${msgBackup.toLowerCase().includes('errore') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {msgBackup}
            </div>
          )}
          <p className="text-[11px] text-gray-400 mt-3">Il file di backup è in formato JSON. Conservalo in un posto sicuro.</p>

        </div>
      )}
    </div>
  );
}
