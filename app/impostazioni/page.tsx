'use client';

import { useEffect, useRef, useState } from 'react';
import { Impostazioni, PrezzoPerPeriodo, ContoCorrente, TIPI_CONTO, TipoContoCorrente, AutomazioniStruttura, AUTOMAZIONI_DEFAULT, AlloggiatiCredentials, OSPITI_DEFAULT, CodiciCamera, OsservatorioCredentials } from '@/lib/types';
import { useCamere } from '@/hooks/useCamere';
import { useStruttura } from '@/hooks/useStruttura';
import { etichetteUnita } from '@/lib/unita';
import {
  Save, PenLine, Users, Trash2, Plus, KeyRound, Link, Copy, Check,
  RefreshCw, Table2, Palette, Download, Upload, ShieldAlert, Building2,
  Radio, Shield, Settings2, CalendarRange, MapPin, Mail, Loader2, Euro,
  Plug, ArrowDownToLine, Wifi, WifiOff, ChevronRight, BarChart3,
} from 'lucide-react';
import { invalidateNomeAppCache } from '@/hooks/useNomeApp';
import { SEGNAPOSTO_ISTRUZIONI, MODELLO_ISTRUZIONI_BASE, componiIstruzioni } from '@/lib/istruzioni';
import { PALETTE, COLOR_MAP, DEFAULT_COLOR_BY_ID, getCameraStyle, CameraColor } from '@/lib/camera-colors';

interface UtenteInfo { id: string; username: string; solo_calendario: boolean; }
interface SyncResult { camera_id: number; canale?: 'booking' | 'airbnb'; aggiunte: number; rimosse: number; errore?: string; }
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
type SubTab = 'camere' | 'ical' | 'prezzi' | 'checkin' | 'codici' | 'alloggiati' | 'osservatorio';
type CanalePrezzi = 'privato' | 'booking' | 'airbnb';

// Stesso controllo della configurazione guidata
const CIN_VALIDO = /^IT[A-Z0-9]{10,}$/i;
const OSS_VUOTE: OsservatorioCredentials = { utente: '', password: '', codice_struttura: '' };

const DEFAULT_PERIODO = { camera_id: 1, nome_periodo: '', data_inizio: '', data_fine: '', prezzo_notte: '', prezzo_booking: '', prezzo_airbnb: '' };

export default function ImpostazioniPage() {
  const camere = useCamere();
  const { struttura: strutturaAttiva, strutture, setStruttura: setStrutturaAttiva } = useStruttura();
  const et = etichetteUnita(strutturaAttiva?.unita_casa);

  const [sezione, setSezione] = useState<MainTab>('strutture');
  const [subTab, setSubTab] = useState<SubTab>('camere');

  // Impostazioni globali (Sheets, branding, iCal output)
  const [imp, setImp] = useState<Impostazioni>({ ical_urls: {}, nomi_camere: {}, prezzi_camere: {}, colori_camere: {}, num_camere: 5 });
  const [colori, setColori] = useState<Record<number, string>>({});
  const [numCamere, setNumCamere] = useState(5);

  // Edit struttura attiva (camere, ical, prezzi)
  const [editNomiCamere, setEditNomiCamere] = useState<Record<number, string>>({});
  const [editColoriCamere, setEditColoriCamere] = useState<Record<number, string>>({});
  const [editOspitiCamere, setEditOspitiCamere] = useState<Record<number, number>>({});
  const [editNumCamere, setEditNumCamere] = useState(5);
  const [editIcalUrls, setEditIcalUrls] = useState<Record<number, string>>({});
  const [editIcalAirbnb, setEditIcalAirbnb] = useState<Record<number, string>>({});
  const [salvatoEditCamere, setSalvatoEditCamere] = useState(false);
  const [salvatoEditIcal, setSalvatoEditIcal] = useState(false);
  const [editIstruzioni, setEditIstruzioni] = useState('');
  // Messaggio di check-in per camera: 0 = struttura; una camera senza testo proprio usa quello della struttura
  const [istrSel, setIstrSel] = useState(0);
  const [editIstrCamere, setEditIstrCamere] = useState<Record<number, string>>({});
  const [salvatoIstrCamera, setSalvatoIstrCamera] = useState(false);
  const [salvatoIstruzioni, setSalvatoIstruzioni] = useState(false);
  const [modelloNonSalvato, setModelloNonSalvato] = useState(false);
  const [editAutomazioni, setEditAutomazioni] = useState<AutomazioniStruttura>({ ...AUTOMAZIONI_DEFAULT });
  const istruzioniRef = useRef<HTMLTextAreaElement>(null);

  // Inline editing dati struttura (nel tab Strutture)
  const [editingDatiId, setEditingDatiId] = useState<string | null>(null);
  const [editDatiNome, setEditDatiNome] = useState('');
  const [editDatiIndirizzo, setEditDatiIndirizzo] = useState('');
  const [editDatiTelefono, setEditDatiTelefono] = useState('');
  const [editDatiRagione, setEditDatiRagione] = useState('');
  const [editDatiPiva, setEditDatiPiva] = useState('');
  const [editDatiCasa, setEditDatiCasa] = useState(false);
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
  const [copiato, setCopiato] = useState<string | null>(null);
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
  // Credenziali proprie di singole camere (strutture con più codici Alloggiati Web)
  const [editAlloggiatiCamere, setEditAlloggiatiCamere] = useState<Record<number, AlloggiatiCredentials>>({});

  // Codici identificativi CIN / CIR (struttura e, facoltativi, per camera)
  const [editCin, setEditCin] = useState('');
  const [editCir, setEditCir] = useState('');
  const [editCodiciCamere, setEditCodiciCamere] = useState<Record<number, CodiciCamera>>({});
  const [salvatoCodici, setSalvatoCodici] = useState(false);

  // Osservatorio Turistico Regione Siciliana: credenziali per i gestionali (struttura e, facoltative, per camera)
  const [editOss, setEditOss] = useState<OsservatorioCredentials>({ ...OSS_VUOTE });
  const [editOssCamere, setEditOssCamere] = useState<Record<number, OsservatorioCredentials>>({});
  const [salvatoOss, setSalvatoOss] = useState(false);
  const [salvatoCamera, setSalvatoCamera] = useState<'codici' | 'alloggiati' | 'osservatorio' | null>(null);
  const [provaOss, setProvaOss] = useState<{ chiave: string; ok: boolean; testo: string } | null>(null);
  const [invioOss, setInvioOss] = useState<{ stato: 'loading' | 'ok' | 'errore'; righe: string[] } | null>(null);
  // Invio storico all'Osservatorio (periodo di arrivi, solo prenotazioni con tassa di soggiorno)
  const [storicoOss, setStoricoOss] = useState({ dal: '', al: '', solo_con_tassa: true });

  // Booking Channel Manager (per struttura)
  const [editCmUrl, setEditCmUrl] = useState('');
  const [editCmHotelId, setEditCmHotelId] = useState('');
  const [editCmUsername, setEditCmUsername] = useState('');
  const [editCmPassword, setEditCmPassword] = useState('');
  const [editCmWebhookSecret, setEditCmWebhookSecret] = useState('');
  const [editCmRoomMap, setEditCmRoomMap] = useState<Record<number, string>>({});
  const [mostraPasswordCm, setMostraPasswordCm] = useState(false);
  const [salvatoCm, setSalvatoCm] = useState(false);
  const [testCmLoading, setTestCmLoading] = useState(false);
  const [testCmResult, setTestCmResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncCmLoading, setSyncCmLoading] = useState(false);
  const [syncCmResult, setSyncCmResult] = useState<{ importate: number; aggiornate: number; cancellate: number; errori: string[] } | null>(null);

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
    setEditOspitiCamere(strutturaAttiva.ospiti_camere ?? {});
    setEditCodiciCamere(strutturaAttiva.codici_camere ?? {});
    setEditAlloggiatiCamere(strutturaAttiva.alloggiati_camere ?? {});
    setEditOssCamere(strutturaAttiva.osservatorio_camere ?? {});
    setEditOspitiCamere(strutturaAttiva.ospiti_camere ?? {});
    setEditNumCamere(strutturaAttiva.num_camere ?? 5);
    setEditIcalUrls(strutturaAttiva.ical_urls ?? {});
    setEditIcalAirbnb(strutturaAttiva.ical_urls_airbnb ?? {});
    // Messaggio vuoto: si parte dal modello, come nella configurazione guidata
    setEditIstruzioni(strutturaAttiva.istruzioni_checkin || MODELLO_ISTRUZIONI_BASE);
    setModelloNonSalvato(!strutturaAttiva.istruzioni_checkin);
    setEditIstrCamere(strutturaAttiva.istruzioni_camere ?? {});
    setIstrSel(0);
    setEditAutomazioni({ ...AUTOMAZIONI_DEFAULT, ...strutturaAttiva.automazioni });
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
        alloggiati_credentials: editAlloggiatiUtente.trim() || editAlloggiatiWskey.trim() ? {
          utente: editAlloggiatiUtente.trim(),
          password: editAlloggiatiPassword,
          wskey: editAlloggiatiWskey.trim(),
        } : null,
      }),
    });
    setSalvatoAlloggiati(true);
    setTimeout(() => setSalvatoAlloggiati(false), 2000);
  }

  async function salvaCodici(id: string) {
    const s = strutture.find(x => x.id === id);
    if (!s) return;
    await fetch(`/api/strutture/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dati_fiscali: { ...s.dati_fiscali, cin: editCin.replace(/\s/g, '').toUpperCase(), cir: editCir.trim() },
      }),
    });
    setSalvatoCodici(true);
    setTimeout(() => setSalvatoCodici(false), 2000);
  }

  async function salvaOsservatorio(id: string) {
    const pulisci = (c: OsservatorioCredentials) => ({ utente: c.utente.trim(), password: c.password, codice_struttura: c.codice_struttura.trim().toUpperCase() });
    const struttura = pulisci(editOss);
    await fetch(`/api/strutture/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        osservatorio_credentials: struttura.utente || struttura.codice_struttura ? struttura : null,
      }),
    });
    setSalvatoOss(true);
    setTimeout(() => setSalvatoOss(false), 2000);
  }

  // Dati per camera (Altro → Camere, schede CIN/CIR, Alloggiati, Osservatorio): si salva solo la scheda aperta
  async function salvaCamere(scheda: 'codici' | 'alloggiati' | 'osservatorio') {
    if (!strutturaAttiva) return;
    // Si salvano solo le camere compilate; le altre usano i dati della struttura
    const filtra = <T,>(m: Record<number, T>, pulisci: (c: T) => T, ok: (c: T) => boolean) =>
      Object.fromEntries(Object.entries(m).map(([k, c]) => [k, pulisci(c)] as const).filter(([, c]) => ok(c))) as Record<number, T>;
    let campi: Record<string, unknown>;
    if (scheda === 'codici') {
      const v = filtra(editCodiciCamere, c => ({ cin: c.cin.replace(/\s/g, '').toUpperCase(), cir: c.cir.trim() }), c => !!(c.cin || c.cir));
      setEditCodiciCamere(v);
      campi = { codici_camere: v };
    } else if (scheda === 'alloggiati') {
      const v = filtra(editAlloggiatiCamere, c => ({ utente: c.utente.trim(), password: c.password, wskey: c.wskey.trim() }), c => !!(c.utente && c.password && c.wskey));
      setEditAlloggiatiCamere(v);
      campi = { alloggiati_camere: v };
    } else {
      const v = filtra(editOssCamere, c => ({ utente: c.utente.trim(), password: c.password, codice_struttura: c.codice_struttura.trim().toUpperCase() }), c => !!(c.utente && c.password && c.codice_struttura));
      setEditOssCamere(v);
      campi = { osservatorio_camere: v };
    }
    await fetch(`/api/strutture/${strutturaAttiva.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campi),
    });
    setSalvatoCamera(scheda);
    setTimeout(() => setSalvatoCamera(null), 2000);
  }

  async function provaOsservatorio(chiave: string, c: OsservatorioCredentials) {
    setProvaOss({ chiave, ok: true, testo: 'Prova in corso…' });
    try {
      const res = await fetch('/api/osservatorio/prova', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c),
      });
      const j = await res.json();
      setProvaOss({ chiave, ok: !!j.ok, testo: j.ok ? 'Accesso riuscito' : (j.errore ?? 'Errore') });
    } catch {
      setProvaOss({ chiave, ok: false, testo: 'Errore di rete' });
    }
  }

  async function inviaOsservatorioOra(storico?: { dal: string; al: string; solo_con_tassa: boolean; limite?: number }) {
    if (storico && !storico.limite && !confirm(`Inviare all'Osservatorio tutti i soggiorni con arrivo dal ${storico.dal} al ${storico.al}${storico.solo_con_tassa ? ' (solo prenotazioni con tassa di soggiorno)' : ''}? I soggiorni già inviati non vengono ripetuti.`)) return;
    setInvioOss({ stato: 'loading', righe: [] });
    try {
      const res = await fetch('/api/osservatorio/invia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storico ?? {}),
      });
      const j = await res.json();
      const righe: string[] = j.errore ? [j.errore]
        : (j.esiti ?? []).map((e: { ospite?: string; esito: string; dettaglio?: string }) =>
          `${e.esito === 'errore' ? '✗' : '✓'} ${e.ospite ?? ''}${e.dettaglio ? ` — ${e.dettaglio}` : ''}`);
      setInvioOss({ stato: j.ok ? 'ok' : 'errore', righe: righe.length ? righe : ['Nessun movimento da comunicare'] });
    } catch {
      setInvioOss({ stato: 'errore', righe: ['Errore di rete'] });
    }
  }

  async function salvaChannelManager(id: string) {
    await fetch(`/api/strutture/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_manager_config: {
          channel_manager_url: editCmUrl.trim(),
          hotel_id: editCmHotelId.trim(),
          username: editCmUsername.trim(),
          password: editCmPassword,
          webhook_secret: editCmWebhookSecret.trim() || undefined,
          room_id_map: editCmRoomMap,
        },
      }),
    });
    setSalvatoCm(true);
    setTimeout(() => setSalvatoCm(false), 2000);
  }

  async function testChannelManager(id: string) {
    setTestCmLoading(true);
    setTestCmResult(null);
    const res = await fetch('/api/channel-manager/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ struttura_id: id }),
    });
    setTestCmResult(await res.json());
    setTestCmLoading(false);
  }

  async function syncChannelManager(id: string) {
    setSyncCmLoading(true);
    setSyncCmResult(null);
    const res = await fetch('/api/channel-manager/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ struttura_id: id, stato: 'all' }),
    });
    setSyncCmResult(await res.json());
    setSyncCmLoading(false);
  }

  async function salvaEditDati(id: string) {
    const s = strutture.find(x => x.id === id);
    await fetch(`/api/strutture/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: editDatiNome.trim(), indirizzo: editDatiIndirizzo.trim(), telefono: editDatiTelefono.trim(),
        dati_fiscali: { ...s?.dati_fiscali, ragione_sociale: editDatiRagione.trim(), partita_iva: editDatiPiva.replace(/\s/g, '') },
        unita_casa: editDatiCasa,
      }),
    });
    // "Camere" ↔ "Case" cambia le scritte in tutta l'app (anche la barra): si ricarica la pagina
    if (s && !!s.unita_casa !== editDatiCasa) { window.location.reload(); return; }
    setSalvatoEditDati(true);
    setTimeout(() => { setSalvatoEditDati(false); setEditingDatiId(null); }, 1500);
    caricaStrutture();
  }

  async function salvaEditCamere() {
    if (!strutturaAttiva) return;
    await fetch(`/api/strutture/${strutturaAttiva.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomi_camere: editNomiCamere, colori_camere: editColoriCamere, ospiti_camere: editOspitiCamere, num_camere: editNumCamere }),
    });
    setSalvatoEditCamere(true);
    setTimeout(() => setSalvatoEditCamere(false), 2000);
  }

  async function salvaEditIcal() {
    if (!strutturaAttiva) return;
    await fetch(`/api/strutture/${strutturaAttiva.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ical_urls: editIcalUrls, ical_urls_airbnb: editIcalAirbnb }),
    });
    setSalvatoEditIcal(true);
    setTimeout(() => setSalvatoEditIcal(false), 2000);
  }

  async function salvaIstruzioni() {
    if (!strutturaAttiva || !editIstruzioni.trim()) return;
    await fetch(`/api/strutture/${strutturaAttiva.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ istruzioni_checkin: editIstruzioni }),
    });
    setModelloNonSalvato(false);
    setSalvatoIstruzioni(true);
    setTimeout(() => setSalvatoIstruzioni(false), 2000);
  }

  // Interruttori delle automazioni: salvati subito
  async function cambiaAutomazione(chiave: keyof AutomazioniStruttura, valore: boolean | string) {
    if (!strutturaAttiva) return;
    const nuove = { ...editAutomazioni, [chiave]: valore };
    setEditAutomazioni(nuove);
    await fetch(`/api/strutture/${strutturaAttiva.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ automazioni: nuove }),
    });
  }

  // Inserisce il segnaposto nel punto del cursore
  // Testo in modifica: della struttura o della camera scelta
  const testoIstr = istrSel ? (editIstrCamere[istrSel] ?? '') : editIstruzioni;
  function setTestoIstr(agg: (t: string) => string) {
    if (istrSel) setEditIstrCamere(prev => ({ ...prev, [istrSel]: agg(prev[istrSel] ?? '') }));
    else setEditIstruzioni(agg);
  }

  // Salva i messaggi delle camere (quelli vuoti tornano al messaggio della struttura)
  async function salvaIstruzioniCamere(valori: Record<number, string>) {
    if (!strutturaAttiva) return;
    const pieni = Object.fromEntries(Object.entries(valori).filter(([, t]) => t.trim())) as Record<number, string>;
    setEditIstrCamere(pieni);
    await fetch(`/api/strutture/${strutturaAttiva.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ istruzioni_camere: pieni }),
    });
    setSalvatoIstrCamera(true);
    setTimeout(() => setSalvatoIstrCamera(false), 2000);
  }

  function inserisciSegnaposto(s: string) {
    const ta = istruzioniRef.current;
    const inizio = ta?.selectionStart ?? testoIstr.length;
    const fine = ta?.selectionEnd ?? testoIstr.length;
    setTestoIstr(t => t.slice(0, inizio) + s + t.slice(fine));
    requestAnimationFrame(() => { ta?.focus(); ta?.setSelectionRange(inizio + s.length, inizio + s.length); });
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

  // Feed in uscita: per Booking.com (predefinito) o per Airbnb (?canale=airbnb)
  const urlFeed = (cameraId: number, canale: 'booking' | 'airbnb') =>
    `${origin || '…'}/api/ical/${cameraId}${canale === 'airbnb' ? '?canale=airbnb' : ''}`;

  async function copia(cameraId: number, canale: 'booking' | 'airbnb' = 'booking') {
    await navigator.clipboard.writeText(urlFeed(cameraId, canale));
    setCopiato(`${canale}-${cameraId}`);
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
    { id: 'camere',    label: et.Camere,   icon: PenLine,   color: 'purple' },
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

  // Campi credenziali Osservatorio (struttura o camera) con prova connessione
  const campiOsservatorio = (c: OsservatorioCredentials, set: (k: keyof OsservatorioCredentials, v: string) => void, chiave: string) => (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 mt-1.5">
          <input type="text" placeholder="Utente" value={c.utente} onChange={e => set('utente', e.target.value)}
            autoComplete="off" className="min-w-0 border rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-teal-400" />
          <input type="password" placeholder="Password" value={c.password} onChange={e => set('password', e.target.value)}
            autoComplete="new-password" className="min-w-0 border rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-teal-400" />
          <input type="text" placeholder="Codice struttura" value={c.codice_struttura} onChange={e => set('codice_struttura', e.target.value)}
            autoComplete="off" className="min-w-0 border rounded px-2 py-1 text-xs font-mono uppercase bg-white focus:outline-none focus:ring-1 focus:ring-teal-400" />
        </div>
        <div className="flex items-center gap-2 mt-1">
          <button type="button" disabled={!c.utente || !c.password} onClick={() => provaOsservatorio(chiave, c)}
            className="text-[11px] border border-teal-300 text-teal-700 bg-white rounded px-2 py-0.5 hover:bg-teal-50 disabled:opacity-40">
            Prova connessione
          </button>
          {provaOss?.chiave === chiave && (
            <span className={`text-[11px] ${provaOss.ok ? 'text-teal-700' : 'text-red-600'}`}>{provaOss.testo}</span>
          )}
        </div>
      </>
  );

  const SUB_TABS: { id: SubTab; label: string }[] = [
    { id: 'camere', label: et.Camere },
    { id: 'prezzi', label: 'Prezzi' },
    { id: 'ical',   label: 'iCal'   },
    { id: 'checkin', label: 'Check-in' },
    { id: 'codici', label: 'CIN / CIR' },
    { id: 'alloggiati', label: 'Alloggiati' },
    { id: 'osservatorio', label: 'Osservatorio' },
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
              <div className="flex border-b border-gray-100 bg-gray-50 px-5 gap-0.5 pt-2 overflow-x-auto">
                {SUB_TABS.map(st => (
                  <button key={st.id} onClick={e => { setSubTab(st.id); e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }); }}
                    className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors rounded-t -mb-px whitespace-nowrap shrink-0 ${
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
                      <h3 className="font-semibold text-gray-700 text-sm">{et.Camere}</h3>
                    </div>
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wide pb-1 border-b">
                        <span className="w-16 sm:w-20 flex-shrink-0">ID</span>
                        <span className="flex-1">Nome</span>
                        <span className="w-14 text-center" title="Ospiti proposti per le nuove prenotazioni">Ospiti</span>
                        <span className="hidden sm:inline">Colore</span>
                      </div>
                      {idsEditCamere.map(id => {
                        const coloreAttuale = (editColoriCamere[id] as CameraColor | undefined) ?? DEFAULT_COLOR_BY_ID[id] ?? 'gray';
                        return (
                          <div key={id} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1.5 pb-2 sm:pb-0 border-b sm:border-0 border-gray-100">
                            <div className="flex items-center gap-1.5 w-16 sm:w-20 flex-shrink-0">
                              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getCameraStyle(id, editColoriCamere[id]).dot}`} />
                              <span className="text-sm text-gray-400">{et.Cam} {id}</span>
                            </div>
                            <input type="text" placeholder={`${et.Camera} ${id}`} value={editNomiCamere[id] ?? ''}
                              onChange={e => setEditNomiCamere(prev => ({ ...prev, [id]: e.target.value }))}
                              className="flex-1 min-w-0 border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
                            />
                            <input type="number" inputMode="numeric" min={1} max={30} title="Ospiti predefiniti"
                              value={editOspitiCamere[id] ?? OSPITI_DEFAULT}
                              onChange={e => setEditOspitiCamere(prev => ({ ...prev, [id]: Math.max(1, Number(e.target.value) || OSPITI_DEFAULT) }))}
                              className="w-14 border rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-purple-400"
                            />
                            <div className="flex items-center gap-1 sm:gap-0.5 flex-wrap w-full sm:w-auto pl-[4.75rem] sm:pl-0">
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
                        {salvatoEditCamere ? 'Salvato!' : `Salva ${et.camere}`}
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
                      Incolla gli URL iCal di importazione da Booking.com per ogni {et.camera}.
                    </p>
                    <div className="space-y-2 mb-3">
                      {idsEditCamere.map(id => (
                        <div key={id} className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
                            <div className={`w-2 h-2 rounded-full ${getCameraStyle(id, editColoriCamere[id]).dot}`} />
                            <span className="text-xs text-gray-500 truncate">{editNomiCamere[id] || `${et.Cam} ${id}`}</span>
                          </div>
                          <input type="url" placeholder="https://ical.booking.com/v1/exportiCalendar?..."
                            value={editIcalUrls[id] ?? ''}
                            onChange={e => setEditIcalUrls(prev => ({ ...prev, [id]: e.target.value }))}
                            className="flex-1 border rounded px-3 py-1.5 text-xs font-mono text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mb-3 mt-5">
                      <Link size={16} className="text-rose-500" />
                      <h3 className="font-semibold text-gray-700 text-sm">URL iCal Airbnb</h3>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">
                      Su Airbnb: Calendario → annuncio → Disponibilità → Collega calendari → Esporta calendario. Si importano solo
                      le prenotazioni (Airbnb non pubblica nome e importo: si completano a mano in Prenotazioni).
                    </p>
                    <div className="space-y-2 mb-3">
                      {idsEditCamere.map(id => (
                        <div key={id} className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
                            <div className={`w-2 h-2 rounded-full ${getCameraStyle(id, editColoriCamere[id]).dot}`} />
                            <span className="text-xs text-gray-500 truncate">{editNomiCamere[id] || `${et.Cam} ${id}`}</span>
                          </div>
                          <input type="url" placeholder="https://www.airbnb.it/calendar/ical/....ics?s=..."
                            value={editIcalAirbnb[id] ?? ''}
                            onChange={e => setEditIcalAirbnb(prev => ({ ...prev, [id]: e.target.value }))}
                            className="flex-1 min-w-0 border rounded px-3 py-1.5 text-xs font-mono text-gray-600 focus:outline-none focus:ring-1 focus:ring-rose-400"
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
                              <div key={`${r.canale ?? 'booking'}-${r.camera_id}`} className={`text-xs px-3 py-1.5 rounded flex items-center gap-2 ${r.errore ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getCameraStyle(r.camera_id, colori[r.camera_id]).dot}`} />
                                <span>{r.canale === 'airbnb' ? 'Airbnb · ' : 'Booking · '}{cam?.nome ?? `${et.Camera} ${r.camera_id}`}:</span>
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
                      <p className="text-xs text-gray-400 mb-3">
                        Extranet → Proprietà → Disponibilità → Sincronizzazione calendario → Importa calendario.
                        Contiene le prenotazioni manuali e quelle di Airbnb.
                      </p>
                      <div className="space-y-2">
                        {idsCamereOutput.map(id => {
                          const nomeAttuale = camere.find(c => c.id === id)?.nome || `${et.Camera} ${id}`;
                          const url = urlFeed(id, 'booking');
                          return (
                            <div key={id} className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getCameraStyle(id, colori[id]).dot}`} />
                                <span className="text-sm text-gray-600 truncate">{nomeAttuale}</span>
                              </div>
                              <code className="flex-1 text-xs bg-gray-50 border rounded px-3 py-2 text-gray-600 truncate">{url}</code>
                              <button onClick={() => copia(id)} title="Copia URL"
                                className={`flex items-center gap-1 px-2 py-2 rounded text-xs font-medium transition-colors flex-shrink-0 ${copiato === `booking-${id}` ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                              >
                                {copiato === `booking-${id}` ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* iCal Output per Airbnb */}
                    <div className="border-t pt-5 mt-5">
                      <div className="flex items-center gap-2 mb-1">
                        <Link size={16} className="text-rose-500" />
                        <h3 className="font-semibold text-gray-700 text-sm">iCal Output — Blocca date su Airbnb</h3>
                      </div>
                      <p className="text-xs text-gray-400 mb-3">
                        Su Airbnb: Calendario → annuncio → Disponibilità → Collega calendari → Importa calendario, un link per annuncio.
                        Contiene le prenotazioni manuali e quelle di Booking.com, senza nomi degli ospiti.
                      </p>
                      <div className="space-y-2">
                        {idsCamereOutput.map(id => {
                          const nomeAttuale = camere.find(c => c.id === id)?.nome || `${et.Camera} ${id}`;
                          const chiave = `airbnb-${id}`;
                          return (
                            <div key={id} className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getCameraStyle(id, colori[id]).dot}`} />
                                <span className="text-sm text-gray-600 truncate">{nomeAttuale}</span>
                              </div>
                              <code className="flex-1 min-w-0 text-xs bg-gray-50 border rounded px-3 py-2 text-gray-600 truncate">{urlFeed(id, 'airbnb')}</code>
                              <button onClick={() => copia(id, 'airbnb')} title="Copia URL"
                                className={`flex items-center gap-1 px-2 py-2 rounded text-xs font-medium transition-colors flex-shrink-0 ${copiato === chiave ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                              >
                                {copiato === chiave ? <Check size={14} /> : <Copy size={14} />}
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
                      const nomeCamera = editNomiCamere[id] || `${et.Camera} ${id}`;
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
                          <label className="block text-xs text-gray-500 mb-1">{et.Camera}</label>
                          <select value={nuovoPeriodo.camera_id}
                            onChange={e => setNuovoPeriodo(p => ({ ...p, camera_id: Number(e.target.value) }))}
                            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                          >
                            {idsEditCamere.map(id => <option key={id} value={id}>{editNomiCamere[id] || `${et.Camera} ${id}`}</option>)}
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

                {/* Sub-tab: CIN / CIR (per camera) */}
                {subTab === 'codici' && (
                  <div>
                    <h3 className="font-semibold text-gray-700 text-sm mb-1">CIN / CIR per {et.camera}</h3>
                    <p className="text-xs text-gray-400 mb-3">Le {et.camere} senza codici propri usano CIN e CIR della struttura (Altro → Strutture). Un campo lasciato vuoto usa il codice della struttura.</p>
                    <div className="mt-2 mb-3">
                      <div className="space-y-1.5">
                        {Array.from({ length: strutturaAttiva.num_camere }, (_, i) => i + 1).map(id => {
                          const c = editCodiciCamere[id];
                          const nome = strutturaAttiva.nomi_camere[id] || `${et.Camera} ${id}`;
                          const setCampo = (k: keyof CodiciCamera, v: string) =>
                            setEditCodiciCamere(prev => ({ ...prev, [id]: { ...(prev[id] ?? { cin: '', cir: '' }), [k]: v } }));
                          return (
                            <div key={id} className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5">
                              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                <input type="checkbox" checked={!!c}
                                  onChange={e => setEditCodiciCamere(prev => {
                                    const nuove = { ...prev };
                                    if (e.target.checked) nuove[id] = { cin: '', cir: '' };
                                    else delete nuove[id];
                                    return nuove;
                                  })}
                                />
                                <span className="font-medium">{nome}</span>
                                <span className="text-gray-400 truncate">{c ? 'codici propri' : 'usa quelli della struttura'}</span>
                              </label>
                              {c && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1.5">
                                  <input type="text" placeholder={`CIN (vuoto = ${strutturaAttiva.dati_fiscali.cin || 'struttura'})`} value={c.cin} onChange={e => setCampo('cin', e.target.value)}
                                    autoComplete="off" className="min-w-0 border rounded px-2 py-1 text-xs font-mono uppercase bg-white focus:outline-none focus:ring-1 focus:ring-amber-400" />
                                  <input type="text" placeholder={`CIR (vuoto = ${strutturaAttiva.dati_fiscali.cir || 'struttura'})`} value={c.cir} onChange={e => setCampo('cir', e.target.value)}
                                    autoComplete="off" className="min-w-0 border rounded px-2 py-1 text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-amber-400" />
                                  {c.cin && !CIN_VALIDO.test(c.cin.replace(/\s/g, '')) && (
                                    <p className="sm:col-span-2 text-[11px] text-amber-600">Il CIN inizia con IT seguito da almeno 10 caratteri.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <button onClick={() => salvaCamere('codici')}
                      className="flex items-center gap-1.5 bg-amber-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-amber-700"
                    >
                      <Save size={14} />
                      {salvatoCamera === 'codici' ? 'Salvato!' : 'Salva'}
                    </button>
                  </div>
                )}

                {/* Sub-tab: ALLOGGIATI WEB (per camera) */}
                {subTab === 'alloggiati' && (
                  <div>
                    <h3 className="font-semibold text-gray-700 text-sm mb-1">Alloggiati Web per {et.camera}</h3>
                    <p className="text-xs text-gray-400 mb-3">Le {et.camere} senza utenza propria inviano le schedine con le credenziali della struttura (Altro → Strutture).</p>
                    <div className="mb-3">
                      <div className="space-y-1.5">
                        {Array.from({ length: strutturaAttiva.num_camere }, (_, i) => i + 1).map(id => {
                          const c = editAlloggiatiCamere[id];
                          const nome = strutturaAttiva.nomi_camere[id] || `${et.Camera} ${id}`;
                          const setCampo = (k: keyof AlloggiatiCredentials, v: string) =>
                            setEditAlloggiatiCamere(prev => ({ ...prev, [id]: { ...prev[id], [k]: v } }));
                          return (
                            <div key={id} className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5">
                              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                <input type="checkbox" checked={!!c}
                                  onChange={e => setEditAlloggiatiCamere(prev => {
                                    const nuove = { ...prev };
                                    if (e.target.checked) nuove[id] = { utente: '', password: '', wskey: '' };
                                    else delete nuove[id];
                                    return nuove;
                                  })}
                                />
                                <span className="font-medium">{nome}</span>
                                <span className="text-gray-400">{c ? 'credenziali proprie' : 'usa quelle della struttura'}</span>
                              </label>
                              {c && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 mt-1.5">
                                  <input type="text" placeholder="Utente" value={c.utente} onChange={e => setCampo('utente', e.target.value)}
                                    autoComplete="off" className="min-w-0 border rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                  <input type={mostraPasswordAlloggiati ? 'text' : 'password'} placeholder="Password" value={c.password} onChange={e => setCampo('password', e.target.value)}
                                    autoComplete="new-password" className="min-w-0 border rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                  <input type="text" placeholder="WsKey" value={c.wskey} onChange={e => setCampo('wskey', e.target.value)}
                                    autoComplete="off" className="min-w-0 border rounded px-2 py-1 text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                  {!(c.utente && c.password && c.wskey) && (
                                    <p className="sm:col-span-3 text-[11px] text-amber-600">Incompleta: finché mancano dei campi non viene salvata e la {et.camera} usa le credenziali della struttura.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <button onClick={() => salvaCamere('alloggiati')}
                      className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
                    >
                      <Save size={14} />
                      {salvatoCamera === 'alloggiati' ? 'Salvato!' : 'Salva'}
                    </button>
                  </div>
                )}

                {/* Sub-tab: OSSERVATORIO TURISTICO (per camera) */}
                {subTab === 'osservatorio' && (
                  <div>
                    <h3 className="font-semibold text-gray-700 text-sm mb-1">Osservatorio Turistico per {et.camera}</h3>
                    <p className="text-xs text-gray-400 mb-3">
                      Per le {et.camere} registrate all&apos;Osservatorio come struttura a sé (codice struttura proprio).
                      Le {et.camere} senza credenziali proprie usano quelle della struttura (Altro → Strutture).
                    </p>
                    <div className="space-y-1.5 mb-3">
                      {Array.from({ length: strutturaAttiva.num_camere }, (_, i) => i + 1).map(id => {
                        const c = editOssCamere[id];
                        const nome = strutturaAttiva.nomi_camere[id] || `${et.Camera} ${id}`;
                        return (
                          <div key={id} className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5">
                            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                              <input type="checkbox" checked={!!c}
                                onChange={e => setEditOssCamere(prev => {
                                  const nuove = { ...prev };
                                  if (e.target.checked) nuove[id] = { ...OSS_VUOTE };
                                  else delete nuove[id];
                                  return nuove;
                                })}
                              />
                              <span className="font-medium">{nome}</span>
                              <span className="text-gray-400 truncate">{c ? 'credenziali proprie' : 'usa quelle della struttura'}</span>
                            </label>
                            {c && campiOsservatorio(c, (k, v) => setEditOssCamere(prev => ({ ...prev, [id]: { ...prev[id], [k]: v } })), `camera-${id}`)}
                          </div>
                        );
                      })}
                    </div>
                    <button onClick={() => salvaCamere('osservatorio')}
                      className="flex items-center gap-1.5 bg-teal-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-teal-700"
                    >
                      <Save size={14} />
                      {salvatoCamera === 'osservatorio' ? 'Salvato!' : 'Salva'}
                    </button>
                  </div>
                )}

                {/* Sub-tab: CHECK-IN */}
                {subTab === 'checkin' && (
                  <div>
                    {/* Invii automatici */}
                    <div className="mb-6 pb-5 border-b">
                      <div className="flex items-center gap-2 mb-3">
                        <RefreshCw size={16} className="text-blue-600" />
                        <h3 className="font-semibold text-gray-700 text-sm">Invii automatici</h3>
                      </div>
                      <div className="space-y-3">
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input type="checkbox" checked={editAutomazioni.portale} onChange={e => cambiaAutomazione('portale', e.target.checked)} className="mt-0.5" />
                          <span className="text-sm text-gray-700">
                            Invio delle schedine ad Alloggiati Web il giorno del check-in
                            <span className="block text-xs text-gray-400">Alle 15:00 e alle 21:00; le schedine già inviate non vengono ripetute.</span>
                          </span>
                        </label>
                      </div>
                      <div className="space-y-3 mt-3">
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input type="checkbox" checked={editAutomazioni.osservatorio} onChange={e => cambiaAutomazione('osservatorio', e.target.checked)} className="mt-0.5" />
                          <span className="text-sm text-gray-700">
                            Invio all&apos;Osservatorio Turistico della Regione Siciliana
                            <span className="block text-xs text-gray-400">
                              Ogni sera alle 23:00: arrivi e partenze del giorno (dalle schede in Alloggiati) e chiusura della giornata,
                              anche senza movimenti. Spegnilo nei periodi di chiusura della struttura.
                            </span>
                          </span>
                        </label>
                        {editAutomazioni.osservatorio && !strutturaAttiva.osservatorio_credentials?.codice_struttura
                          && Object.keys(strutturaAttiva.osservatorio_camere ?? {}).length === 0 && (
                          <p className="text-xs text-amber-600">Mancano le credenziali dell&apos;Osservatorio (scheda Strutture).</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap pl-6">
                          <label className="text-xs text-gray-600">Invia gli arrivi dal</label>
                          <input type="date" value={editAutomazioni.osservatorio_dal ?? ''}
                            onChange={e => cambiaAutomazione('osservatorio_dal', e.target.value)}
                            className="border rounded px-2 py-1 text-xs w-[8.5rem]" />
                          <span className="text-[11px] text-gray-400 basis-full">
                            Gli arrivi precedenti non vengono inviati in automatico (es. già inseriti a mano sul portale); le partenze dei soggiorni già comunicati sì.
                          </span>
                        </div>
                        <div>
                          <button type="button" onClick={() => inviaOsservatorioOra()} disabled={invioOss?.stato === 'loading'}
                            className="flex items-center gap-1.5 border border-teal-300 text-teal-700 px-2.5 py-1 rounded text-xs font-medium hover:bg-teal-50 disabled:opacity-50">
                            {invioOss?.stato === 'loading' ? <Loader2 size={12} className="animate-spin" /> : <BarChart3 size={12} />}
                            Invia ora all&apos;Osservatorio (fino a oggi)
                          </button>
                          <div className="mt-3 rounded border border-gray-200 p-3 space-y-2">
                            <div className="text-xs font-semibold text-gray-700">Invio storico (massivo)</div>
                            <p className="text-[11px] text-gray-400">
                              Soggiorni con arrivo nel periodo: arrivo e partenza, senza chiusure giornaliere. Prima prova con un solo soggiorno
                              e controlla sul portale dell&apos;Osservatorio che sia arrivato giusto.
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <label className="text-xs text-gray-600">Arrivi dal</label>
                              <input type="date" value={storicoOss.dal} onChange={e => setStoricoOss(v => ({ ...v, dal: e.target.value }))}
                                className="border rounded px-2 py-1 text-xs w-[8.5rem]" />
                              <label className="text-xs text-gray-600">al</label>
                              <input type="date" value={storicoOss.al} onChange={e => setStoricoOss(v => ({ ...v, al: e.target.value }))}
                                className="border rounded px-2 py-1 text-xs w-[8.5rem]" />
                            </div>
                            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                              <input type="checkbox" checked={storicoOss.solo_con_tassa} onChange={e => setStoricoOss(v => ({ ...v, solo_con_tassa: e.target.checked }))} />
                              Solo prenotazioni con tassa di soggiorno
                            </label>
                            <div className="flex gap-2 flex-wrap">
                              <button type="button" disabled={!storicoOss.dal || !storicoOss.al || invioOss?.stato === 'loading'}
                                onClick={() => inviaOsservatorioOra({ ...storicoOss, limite: 1 })}
                                className="border border-teal-300 text-teal-700 px-2.5 py-1 rounded text-xs font-medium hover:bg-teal-50 disabled:opacity-40">
                                Prova con un solo soggiorno
                              </button>
                              <button type="button" disabled={!storicoOss.dal || !storicoOss.al || invioOss?.stato === 'loading'}
                                onClick={() => inviaOsservatorioOra(storicoOss)}
                                className="bg-teal-600 text-white px-2.5 py-1 rounded text-xs font-medium hover:bg-teal-700 disabled:opacity-40">
                                Invia tutto il periodo
                              </button>
                            </div>
                          </div>
                          {invioOss && invioOss.stato !== 'loading' && (
                            <ul className={`mt-1.5 text-xs rounded px-3 py-2 space-y-0.5 ${invioOss.stato === 'ok' ? 'bg-teal-50 text-teal-800' : 'bg-red-50 text-red-700'}`}>
                              {invioOss.righe.map((r, i) => <li key={i} className="break-words">{r}</li>)}
                            </ul>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-3">Link di registrazione e istruzioni agli ospiti: da Prenotazioni → WhatsApp.</p>
                      {editAutomazioni.portale && !strutturaAttiva.telefono && (
                        <p className="text-xs text-amber-600 mt-3">Indica il telefono WhatsApp della struttura (scheda Strutture → dati struttura): lì arrivano gli avvisi quando un invio non riesce.</p>
                      )}
                      {editAutomazioni.portale && !strutturaAttiva.alloggiati_credentials?.wskey
                        && Object.keys(strutturaAttiva.alloggiati_camere ?? {}).length < strutturaAttiva.num_camere && (
                        <p className="text-xs text-amber-600 mt-1">Mancano le credenziali Alloggiati Web della struttura o di alcune {et.camere} (scheda Strutture).</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <Mail size={16} className="text-blue-600" />
                      <h3 className="font-semibold text-gray-700 text-sm">Messaggio di check-in</h3>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">
                      Inviato all&apos;ospite dalla pagina Alloggiati. Tocca un segnaposto per inserirlo: viene sostituito con i dati della prenotazione.
                      Le {et.camere} senza un messaggio proprio usano quello della struttura.
                    </p>
                    <div className="flex items-center gap-2 mb-3">
                      <label className="text-xs text-gray-600 shrink-0">Messaggio per</label>
                      <select value={istrSel} onChange={e => setIstrSel(Number(e.target.value))}
                        className="border rounded px-2 py-1 text-sm min-w-0 flex-1 sm:flex-none focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value={0}>Struttura (predefinito)</option>
                        {Array.from({ length: strutturaAttiva.num_camere }, (_, i) => i + 1).map(id => (
                          <option key={id} value={id}>
                            {strutturaAttiva.nomi_camere[id] || `${et.Camera} ${id}`}{editIstrCamere[id]?.trim() ? ' · messaggio proprio' : ' · usa struttura'}
                          </option>
                        ))}
                      </select>
                    </div>
                    {istrSel > 0 && editIstrCamere[istrSel] === undefined ? (
                      <div className="rounded border border-dashed border-gray-300 p-4 text-sm text-gray-600 mb-3">
                        Questa {et.camera} usa il messaggio della struttura.
                        <button type="button" onClick={() => setEditIstrCamere(prev => ({ ...prev, [istrSel]: editIstruzioni }))}
                          className="block mt-2 text-blue-600 text-sm underline text-left">
                          Scrivi un messaggio solo per questa {et.camera} (parte dal testo della struttura)
                        </button>
                      </div>
                    ) : (<>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {Object.entries(SEGNAPOSTO_ISTRUZIONI).map(([s, descr]) => (
                        <button key={s} type="button" onClick={() => inserisciSegnaposto(s)} title={descr}
                          className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <textarea ref={istruzioniRef} value={testoIstr} onChange={e => { const v = e.target.value; setTestoIstr(() => v); }}
                      rows={14}
                      className="w-full border rounded px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    {istrSel === 0 && modelloNonSalvato && (
                      <p className="text-xs text-amber-600 mt-1">Modello di partenza, non ancora salvato: completa le parti tra [ ].</p>
                    )}
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      {istrSel === 0 ? (
                        <button onClick={salvaIstruzioni} disabled={!editIstruzioni.trim()}
                          className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Save size={14} />
                          {salvatoIstruzioni ? 'Salvato!' : 'Salva messaggio'}
                        </button>
                      ) : (
                        <>
                          <button onClick={() => salvaIstruzioniCamere(editIstrCamere)} disabled={!testoIstr.trim()}
                            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Save size={14} />
                            {salvatoIstrCamera ? 'Salvato!' : `Salva messaggio della ${et.camera}`}
                          </button>
                          <button type="button"
                            onClick={() => { const v = { ...editIstrCamere }; delete v[istrSel]; salvaIstruzioniCamere(v); }}
                            className="text-sm text-gray-500 underline">
                            Usa il messaggio della struttura
                          </button>
                        </>
                      )}
                    </div>
                    </>)}

                    <div className="border-t pt-4 mt-5">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Anteprima (dati di esempio)</h4>
                      <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap break-words">
                        {componiIstruzioni(istrSel && editIstrCamere[istrSel] !== undefined ? testoIstr : editIstruzioni, {
                          ospite: 'Mario Rossi',
                          camera: istrSel || 1,
                          tassa: '€ 6,00',
                          indirizzo: strutturaAttiva.indirizzo || 'indirizzo della struttura',
                          struttura: strutturaAttiva.nome,
                          cin: editCodiciCamere[istrSel || 1]?.cin || strutturaAttiva.dati_fiscali.cin,
                          cir: editCodiciCamere[istrSel || 1]?.cir || strutturaAttiva.dati_fiscali.cir,
                        })}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </>
      )}

      {/* ── STRUTTURE─────────────────────────────────────────────────── */}
      {sezione === 'strutture' && (() => {
        const selezionata = strutture.find(s => s.id === editingDatiId) ?? null;
        function seleziona(s: typeof strutture[0]) {
          setEditingDatiId(s.id);
          setEditDatiNome(s.nome);
          setEditDatiIndirizzo(s.indirizzo ?? '');
          setEditDatiTelefono(s.telefono ?? '');
          setEditDatiRagione(s.dati_fiscali?.ragione_sociale ?? '');
          setEditDatiPiva(s.dati_fiscali?.partita_iva ?? '');
          setEditDatiCasa(!!s.unita_casa);
          setSalvatoEditDati(false);
          setEditAlloggiatiUtente(s.alloggiati_credentials?.utente ?? '');
          setEditAlloggiatiPassword(s.alloggiati_credentials?.password ?? '');
          setEditAlloggiatiWskey(s.alloggiati_credentials?.wskey ?? '');
          setEditCin(s.dati_fiscali?.cin ?? '');
          setEditCir(s.dati_fiscali?.cir ?? '');
          setSalvatoCodici(false);
          setEditOss(s.osservatorio_credentials ?? { ...OSS_VUOTE });
          setSalvatoOss(false);
          setProvaOss(null);
          setMostraPasswordAlloggiati(false);
          setSalvatoAlloggiati(false);
          setEditCmUrl(s.channel_manager_config?.channel_manager_url ?? '');
          setEditCmHotelId(s.channel_manager_config?.hotel_id ?? '');
          setEditCmUsername(s.channel_manager_config?.username ?? '');
          setEditCmPassword(s.channel_manager_config?.password ?? '');
          setEditCmWebhookSecret(s.channel_manager_config?.webhook_secret ?? '');
          setEditCmRoomMap(s.channel_manager_config?.room_id_map ?? {});
          setMostraPasswordCm(false);
          setSalvatoCm(false);
          setTestCmResult(null);
          setSyncCmResult(null);
          setEditContiCorrenti(s.conti_correnti?.length ? [...s.conti_correnti] : [{ id: 'contanti-default', tipo: 'contanti' as const, nome: 'Contanti' }]);
          setNuovoContoNome('');
          setNuovoContoTipo('contanti');
          setSalvatoConti(false);
        }
        return (
          <div className="space-y-4">

            {/* Configurazione guidata: dati fiscali, CIN/CIR, regole, istruzioni check-in */}
            <a href="/configurazione"
              className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 hover:bg-blue-100 transition-colors">
              <div>
                <span className="text-sm font-semibold text-blue-800 block">Configurazione guidata della struttura attiva</span>
                <span className="text-xs text-blue-600">Dati societari, CIN/CIR, {et.camere}, Alloggiati Web, tassa di soggiorno, istruzioni di check-in</span>
              </div>
              <ChevronRight size={16} className="text-blue-500 shrink-0" />
            </a>

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
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Telefono WhatsApp della struttura</label>
                      <input type="tel" value={editDatiTelefono} onChange={e => setEditDatiTelefono(e.target.value)} placeholder="+39 333 1234567"
                        className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                      />
                      <p className="text-[11px] text-gray-400 mt-0.5">Riceve gli avvisi quando un invio automatico (link ospite, Alloggiati Web) non riesce.</p>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs text-gray-500 mb-1">Ragione sociale / titolare</label>
                      <input type="text" value={editDatiRagione} onChange={e => setEditDatiRagione(e.target.value)}
                        className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs text-gray-500 mb-1">Partita IVA</label>
                      <input type="text" inputMode="numeric" value={editDatiPiva} onChange={e => setEditDatiPiva(e.target.value)} placeholder="11 cifre"
                        className="w-full border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-slate-400"
                      />
                      {editDatiPiva && !/^\d{11}$/.test(editDatiPiva.replace(/\s/g, '')) && (
                        <p className="text-[11px] text-amber-600 mt-0.5">La partita IVA italiana ha 11 cifre.</p>
                      )}
                    </div>
                    <label className="col-span-2 flex items-start gap-2 cursor-pointer rounded border border-gray-100 bg-gray-50 px-2 py-2">
                      <input type="checkbox" checked={editDatiCasa} onChange={e => setEditDatiCasa(e.target.checked)} className="mt-0.5" />
                      <span className="text-sm text-gray-700">
                        Le unità sono case / appartamenti
                        <span className="block text-[11px] text-gray-400">
                          In tutta l&apos;app &quot;Casa/Case&quot; al posto di &quot;Camera/Camere&quot;. Per chi ha più appartamenti con CIN e CIR
                          diversi ma la stessa partita IVA (CIN/CIR per casa in Altro → Case → CIN / CIR).
                        </span>
                      </span>
                    </label>
                  </div>
                  <button onClick={() => salvaEditDati(selezionata.id)} disabled={!editDatiNome.trim()}
                    className="flex items-center gap-1.5 bg-slate-700 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-slate-800 disabled:opacity-40"
                  >
                    <Save size={13} />
                    {salvatoEditDati ? 'Salvato!' : 'Salva dati struttura'}
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
                        className="flex-1 min-w-0 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
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

                  {/* Codici identificativi CIN / CIR */}
                  <div className="border-t pt-4 mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield size={14} className="text-amber-600" />
                      <span className="font-semibold text-gray-700 text-xs">Codici identificativi (CIN / CIR)</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">Codici della struttura. Valgono per tutte le {et.camere} che non hanno codici propri (Altro → {et.Camere} → CIN / CIR).</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-1">
                      <input type="text" placeholder="CIN (IT…)" value={editCin} onChange={e => setEditCin(e.target.value)}
                        autoComplete="off" className="min-w-0 border rounded px-2 py-1.5 text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-amber-400" />
                      <input type="text" placeholder="CIR / codice regionale" value={editCir} onChange={e => setEditCir(e.target.value)}
                        autoComplete="off" className="min-w-0 border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-400" />
                    </div>
                    {editCin && !CIN_VALIDO.test(editCin.replace(/\s/g, '')) && (
                      <p className="text-[11px] text-amber-600 mb-1">Il CIN inizia con IT seguito da almeno 10 caratteri.</p>
                    )}
                    <button onClick={() => salvaCodici(selezionata.id)}
                      className="flex items-center gap-1.5 bg-amber-600 text-white px-2.5 py-1.5 rounded text-xs font-medium hover:bg-amber-700"
                    >
                      <Save size={12} />
                      {salvatoCodici ? 'Salvato!' : 'Salva codici'}
                    </button>
                  </div>

                  {/* Osservatorio Turistico Regione Siciliana */}
                  <div className="border-t pt-4 mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 size={14} className="text-teal-600" />
                      <span className="font-semibold text-gray-700 text-xs">Osservatorio Turistico (Regione Siciliana)</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">
                      Credenziali per i gestionali (WebAPI), diverse da quelle del portale: si richiedono all&apos;Osservatorio
                      e valgono per una struttura ricettiva. Il codice struttura è del tipo TRS-IT-SIC-…
                      Credenziali diverse per singole {et.camere}: Altro → {et.Camere} → Osservatorio.
                    </p>
                    {campiOsservatorio(editOss, (k, v) => setEditOss(prev => ({ ...prev, [k]: v })), 'struttura')}
                    <button onClick={() => salvaOsservatorio(selezionata.id)}
                      className="flex items-center gap-1.5 bg-teal-600 text-white px-2.5 py-1.5 rounded text-xs font-medium hover:bg-teal-700"
                    >
                      <Save size={12} />
                      {salvatoOss ? 'Salvato!' : 'Salva credenziali Osservatorio'}
                    </button>
                  </div>

                  {/* AlloggiatiWeb */}
                  <div className="border-t pt-4 mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield size={14} className="text-blue-600" />
                      <span className="font-semibold text-gray-700 text-xs">AlloggiatiWeb</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">Credenziali del portale Polizia di Stato (Questura) per l&apos;invio delle schedine. Valgono per tutte le {et.camere} che non hanno credenziali proprie (Altro → {et.Camere} → Alloggiati).</p>
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
                      className="flex items-center gap-1.5 bg-blue-600 text-white px-2.5 py-1.5 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-40"
                    >
                      <Save size={12} />
                      {salvatoAlloggiati ? 'Salvato!' : 'Salva credenziali'}
                    </button>
                  </div>

                  {/* Booking Channel Manager */}
                  <div className="border-t pt-4 mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Plug size={14} className="text-indigo-600" />
                      <span className="font-semibold text-gray-700 text-xs">Booking.com Channel Manager</span>
                      {editCmUrl && testCmResult && (
                        testCmResult.ok
                          ? <span className="flex items-center gap-1 text-[10px] text-green-700 bg-green-50 rounded px-1.5 py-0.5"><Wifi size={10}/> Connesso</span>
                          : <span className="flex items-center gap-1 text-[10px] text-red-600 bg-red-50 rounded px-1.5 py-0.5"><WifiOff size={10}/> Errore</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mb-3">
                      Connetti questa struttura al Channel Manager per sincronizzare tariffe, disponibilità e prenotazioni con Booking.com.
                    </p>

                    {/* Credenziali principali */}
                    <div className="space-y-2 mb-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">URL Channel Manager</label>
                        <input type="url" placeholder="http://localhost:3001" value={editCmUrl}
                          onChange={e => setEditCmUrl(e.target.value)}
                          className="w-full border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">Hotel ID (Booking.com)</label>
                          <input type="text" placeholder="hotel-test-001" value={editCmHotelId}
                            onChange={e => setEditCmHotelId(e.target.value)}
                            className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">Username</label>
                          <input type="text" placeholder="machine-account-user" value={editCmUsername}
                            onChange={e => setEditCmUsername(e.target.value)}
                            autoComplete="off"
                            className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <input type={mostraPasswordCm ? 'text' : 'password'} placeholder="Password"
                          value={editCmPassword} onChange={e => setEditCmPassword(e.target.value)}
                          autoComplete="new-password"
                          className="flex-1 border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                        <button type="button" onClick={() => setMostraPasswordCm(p => !p)} className="border rounded px-2 text-xs text-gray-500 hover:bg-gray-50">
                          {mostraPasswordCm ? 'Nascondi' : 'Mostra'}
                        </button>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Webhook Secret (opzionale)</label>
                        <input type="text" placeholder="Segreto HMAC per validare i push di Booking.com" value={editCmWebhookSecret}
                          onChange={e => setEditCmWebhookSecret(e.target.value)}
                          className="w-full border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </div>
                    </div>

                    {/* Mapping camere */}
                    <div className="mb-3">
                      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        Mapping {et.camere} → Room ID Channel Manager
                      </p>
                      <div className="space-y-1">
                        {idsEditCamere.map(id => (
                          <div key={id} className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 w-28 shrink-0">
                              <div className={`w-2 h-2 rounded-full ${getCameraStyle(id, editColoriCamere[id]).dot}`} />
                              <span className="text-xs text-gray-600 truncate">{editNomiCamere[id] || `${et.Camera} ${id}`}</span>
                            </div>
                            <input type="text" placeholder="room-deluxe-01"
                              value={editCmRoomMap[id] ?? ''}
                              onChange={e => setEditCmRoomMap(prev => ({ ...prev, [id]: e.target.value }))}
                              className="flex-1 border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Inserisci gli ID esatti usati nel Channel Manager (es. room-deluxe-01).
                      </p>
                    </div>

                    {/* Azioni */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => salvaChannelManager(selezionata.id)}
                        disabled={!editCmUrl || !editCmHotelId}
                        className="flex items-center gap-1.5 bg-indigo-600 text-white px-2.5 py-1.5 rounded text-xs font-medium hover:bg-indigo-700 disabled:opacity-40"
                      >
                        <Save size={12} />
                        {salvatoCm ? 'Salvato!' : 'Salva configurazione'}
                      </button>
                      <button onClick={() => testChannelManager(selezionata.id)}
                        disabled={testCmLoading || !editCmUrl}
                        className="flex items-center gap-1.5 border border-indigo-300 text-indigo-700 px-2.5 py-1.5 rounded text-xs font-medium hover:bg-indigo-50 disabled:opacity-40"
                      >
                        {testCmLoading ? <Loader2 size={12} className="animate-spin" /> : <Wifi size={12} />}
                        Test connessione
                      </button>
                      <button onClick={() => syncChannelManager(selezionata.id)}
                        disabled={syncCmLoading || !editCmUrl}
                        className="flex items-center gap-1.5 border border-green-300 text-green-700 px-2.5 py-1.5 rounded text-xs font-medium hover:bg-green-50 disabled:opacity-40"
                      >
                        {syncCmLoading ? <Loader2 size={12} className="animate-spin" /> : <ArrowDownToLine size={12} />}
                        Importa prenotazioni
                      </button>
                    </div>

                    {/* Risultato test */}
                    {testCmResult && (
                      <div className={`mt-2 text-xs px-3 py-2 rounded flex items-center gap-2 ${testCmResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {testCmResult.ok ? <Wifi size={12} /> : <WifiOff size={12} />}
                        {testCmResult.message}
                      </div>
                    )}

                    {/* Risultato sync */}
                    {syncCmResult && (
                      <div className="mt-2 text-xs space-y-1">
                        <div className="px-3 py-2 rounded bg-blue-50 text-blue-700">
                          Sync completato — {syncCmResult.importate} nuove, {syncCmResult.aggiornate} aggiornate, {syncCmResult.cancellate} cancellate
                        </div>
                        {syncCmResult.errori.length > 0 && syncCmResult.errori.map((e, i) => (
                          <div key={i} className="px-3 py-1.5 rounded bg-red-50 text-red-600">{e}</div>
                        ))}
                      </div>
                    )}
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
