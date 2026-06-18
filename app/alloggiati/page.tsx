'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { format, addDays, subDays, parseISO, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';
import TassaSoggiorno from './TassaSoggiorno';
import { ChevronLeft, ChevronRight, Plus, Download, Pencil, Trash2, X, UserCheck, ScanLine, Loader2, Mail, ClipboardCheck, Clock, SendHorizonal, MessageCircle, Upload } from 'lucide-react';
import { Alloggiato, Prenotazione, TIPI_ALLOGGIATO, TipoAlloggiato } from '@/lib/types';
import { getCameraStyle } from '@/lib/camera-colors';
import { useCamere } from '@/hooks/useCamere';
import { PAESI, CODICE_ITALIA } from '@/lib/codici-alloggiati';
import { COMUNI } from '@/lib/comuni-italiani';

const oggi = new Date().toISOString().split('T')[0];

type ModalState = {
  open: boolean;
  editing: Alloggiato | null;
  prenotazioneId: string | null;
};

const FORM_VUOTO = {
  tipo: '16' as TipoAlloggiato,
  data_arrivo: oggi,
  permanenza: 1,
  cognome: '',
  nome: '',
  sesso: 'M' as 'M' | 'F',
  data_nascita: '',
  comune_nascita: '',
  provincia_nascita: '',
  stato_nascita: '',
  cittadinanza: '',
  tipo_documento: '',
  numero_documento: '',
  luogo_rilascio: '',
  prenotazione_id: '',
};

type CheckinStatus = {
  linkInviato: boolean;
  linkCreatedAt: string | null;
  alloggiatiCount: number;
};

function rigaLabel(a: Alloggiato): string {
  return `${a.cognome.toUpperCase()} ${a.nome}`;
}

export default function AlloggiatiPage() {
  const camere = useCamere();
  const [data, setData] = useState(oggi);
  const [alloggiati, setAlloggiati] = useState<Alloggiato[]>([]);
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ open: false, editing: null, prenotazioneId: null });
  const [form, setForm] = useState({ ...FORM_VUOTO });
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<{ ok: boolean; testo: string } | null>(null);
  const [invioLink, setInvioLink] = useState<Record<string, 'idle' | 'loading' | 'ok' | 'error'>>({});
  const [invioLinkMsg, setInvioLinkMsg] = useState<Record<string, string>>({});
  const [invioWA, setInvioWA] = useState<Record<string, 'idle' | 'loading' | 'ok' | 'error'>>({});
  const [invioWAMsg, setInvioWAMsg] = useState<Record<string, string>>({});
  const [emailPrompt, setEmailPrompt] = useState<Record<string, boolean>>({});
  const [emailInput, setEmailInput] = useState<Record<string, string>>({});
  const [invioTutti, setInvioTutti] = useState<'idle' | 'loading' | 'done'>('idle');
  const [invioTuttiMsg, setInvioTuttiMsg] = useState('');
  const [emailEditId, setEmailEditId] = useState<string | null>(null);
  const [emailEditVal, setEmailEditVal] = useState('');
  const [checkinStatus, setCheckinStatus] = useState<Record<string, CheckinStatus>>({});
  const [invioPortale, setInvioPortale] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [invioPortaleMsg, setInvioPortaleMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'alloggiati' | 'tassa'>('alloggiati');

  const carica = useCallback(async (d: string) => {
    setLoading(true);
    const [resA, resP] = await Promise.all([
      fetch(`/api/alloggiati?data=${d}`),
      fetch('/api/prenotazioni'),
    ]);
    const [a, p] = await Promise.all([resA.json(), resP.json()]);
    setAlloggiati(a as Alloggiato[]);
    const pFiltrate = (p as Prenotazione[]).filter(pr => pr.check_in === d && pr.stato !== 'cancellata');
    setPrenotazioni(pFiltrate);
    if (pFiltrate.length > 0) {
      const ids = pFiltrate.map(pr => pr.id).join(',');
      const resS = await fetch(`/api/alloggiati/checkin-status?ids=${ids}`);
      setCheckinStatus(await resS.json());
    } else {
      setCheckinStatus({});
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    carica(data);
  }, [data, carica]);

  function spostaDi(delta: number) {
    const d = delta > 0 ? addDays(parseISO(data), delta) : subDays(parseISO(data), -delta);
    setData(format(d, 'yyyy-MM-dd'));
  }

  function apriModal(prenotazioneId: string | null, editing: Alloggiato | null) {
    if (editing) {
      setForm({
        tipo: editing.tipo,
        data_arrivo: editing.data_arrivo,
        permanenza: editing.permanenza,
        cognome: editing.cognome,
        nome: editing.nome,
        sesso: editing.sesso,
        data_nascita: editing.data_nascita,
        comune_nascita: editing.comune_nascita,
        provincia_nascita: editing.provincia_nascita,
        stato_nascita: editing.stato_nascita,
        cittadinanza: editing.cittadinanza,
        tipo_documento: editing.tipo_documento,
        numero_documento: editing.numero_documento,
        luogo_rilascio: editing.luogo_rilascio,
        prenotazione_id: editing.prenotazione_id ?? '',
      });
    } else {
      let permanenzaDefault = 1;
      if (prenotazioneId) {
        const pren = prenotazioni.find(p => p.id === prenotazioneId);
        if (pren) {
          permanenzaDefault = differenceInDays(parseISO(pren.check_out), parseISO(pren.check_in));
          if (permanenzaDefault < 1) permanenzaDefault = 1;
        }
      }
      setForm({ ...FORM_VUOTO, data_arrivo: data, permanenza: permanenzaDefault, prenotazione_id: prenotazioneId ?? '' });
    }
    setModal({ open: true, editing, prenotazioneId });
  }

  function chiudiModal() {
    setModal({ open: false, editing: null, prenotazioneId: null });
  }

  function setF(k: string, v: string | number) {
    setForm(p => ({ ...p, [k]: v }));
  }

  async function scanDocument(file: File) {
    setScanning(true);
    setScanMsg(null);
    const fd = new FormData();
    fd.append('immagine', file);
    try {
      const res = await fetch('/api/alloggiati/scan', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || json.errore) {
        setScanMsg({ ok: false, testo: json.errore ?? 'Errore lettura documento' });
        return;
      }
      setForm(prev => ({
        ...prev,
        cognome:          json.cognome         || prev.cognome,
        nome:             json.nome            || prev.nome,
        sesso:            (json.sesso === 'M' || json.sesso === 'F') ? json.sesso : prev.sesso,
        data_nascita:     json.data_nascita    || prev.data_nascita,
        tipo_documento:   json.tipo_documento  || prev.tipo_documento,
        numero_documento: json.numero_documento || prev.numero_documento,
        stato_nascita:    json.codice_stato_nascita !== undefined ? json.codice_stato_nascita : prev.stato_nascita,
        cittadinanza:     json.codice_cittadinanza  || prev.cittadinanza,
        comune_nascita:   json.luogo_nascita_testo  || prev.comune_nascita,
        luogo_rilascio:   json.codice_luogo_rilascio || prev.luogo_rilascio,
      }));
      setScanMsg({ ok: true, testo: `Documento letto: ${json.cognome} ${json.nome}` });
    } catch {
      setScanMsg({ ok: false, testo: 'Errore di rete' });
    } finally {
      setScanning(false);
      setTimeout(() => setScanMsg(null), 5000);
    }
  }

  async function salva() {
    setSaving(true);
    const payload = {
      tipo: form.tipo,
      data_arrivo: form.data_arrivo,
      permanenza: Number(form.permanenza),
      cognome: form.cognome,
      nome: form.nome,
      sesso: form.sesso,
      data_nascita: form.data_nascita,
      comune_nascita: form.comune_nascita,
      provincia_nascita: form.provincia_nascita,
      stato_nascita: form.stato_nascita,
      cittadinanza: form.cittadinanza,
      tipo_documento: form.tipo_documento,
      numero_documento: form.numero_documento,
      luogo_rilascio: form.luogo_rilascio,
      prenotazione_id: form.prenotazione_id || undefined,
    };
    if (modal.editing) {
      await fetch(`/api/alloggiati/${modal.editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch('/api/alloggiati', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    chiudiModal();
    carica(data);
  }

  async function inviaLink(prenotazioneId: string, emailOverride?: string) {
    setEmailPrompt(prev => ({ ...prev, [prenotazioneId]: false }));
    setInvioLink(prev => ({ ...prev, [prenotazioneId]: 'loading' }));
    const res = await fetch('/api/alloggiati/invia-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prenotazione_id: prenotazioneId, email_override: emailOverride }),
    });
    const json = await res.json();
    if (json.ok) {
      setInvioLink(prev => ({ ...prev, [prenotazioneId]: 'ok' }));
    } else {
      setInvioLink(prev => ({ ...prev, [prenotazioneId]: 'error' }));
      setInvioLinkMsg(prev => ({ ...prev, [prenotazioneId]: json.errore ?? 'Errore sconosciuto' }));
    }
    setTimeout(() => setInvioLink(prev => ({ ...prev, [prenotazioneId]: 'idle' })), 6000);
    // Refresh status after sending
    const ids = prenotazioni.map(p => p.id).join(',');
    if (ids) fetch(`/api/alloggiati/checkin-status?ids=${ids}`).then(r => r.json()).then(setCheckinStatus);
  }

  async function inviaLinkWhatsApp(prenotazioneId: string, telefono: string) {
    setInvioWA(prev => ({ ...prev, [prenotazioneId]: 'loading' }));
    try {
      const res = await fetch('/api/alloggiati/invia-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prenotazione_id: prenotazioneId, canale: 'whatsapp_link' }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.errore ?? 'Errore sconosciuto');
      // Normalizza numero per wa.me: solo cifre con prefisso internazionale
      const num = telefono.trim().replace(/[\s\-().]/g, '');
      const waNum = num.startsWith('+') ? num.slice(1)
                  : num.startsWith('00') ? num.slice(2)
                  : num.startsWith('3') && num.length === 10 ? '39' + num
                  : num;
      const waUrl = `https://wa.me/${waNum}?text=${encodeURIComponent(json.testo)}`;
      window.open(waUrl, '_blank');
      setInvioWA(prev => ({ ...prev, [prenotazioneId]: 'ok' }));
    } catch (e) {
      setInvioWA(prev => ({ ...prev, [prenotazioneId]: 'error' }));
      setInvioWAMsg(prev => ({ ...prev, [prenotazioneId]: e instanceof Error ? e.message : 'Errore' }));
    }
    setTimeout(() => setInvioWA(prev => ({ ...prev, [prenotazioneId]: 'idle' })), 6000);
  }

  async function inviaLinkATutti() {
    const registratiIds = new Set(alloggiati.map(a => a.prenotazione_id).filter(Boolean));
    const daInviare = prenotazioni.filter(p => p.ospite_email && !registratiIds.has(p.id));
    if (daInviare.length === 0) return;
    setInvioTutti('loading');
    let ok = 0; let err = 0;
    for (const pren of daInviare) {
      try {
        const res = await fetch('/api/alloggiati/invia-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prenotazione_id: pren.id }),
        });
        const json = await res.json();
        if (json.ok) {
          ok++;
          setInvioLink(prev => ({ ...prev, [pren.id]: 'ok' }));
        } else {
          err++;
          setInvioLink(prev => ({ ...prev, [pren.id]: 'error' }));
          setInvioLinkMsg(prev => ({ ...prev, [pren.id]: json.errore ?? 'Errore' }));
        }
      } catch {
        err++;
      }
    }
    setInvioTuttiMsg(`✓ ${ok} inviati${err > 0 ? ` · ${err} errori` : ''}`);
    setInvioTutti('done');
    setTimeout(() => { setInvioTutti('idle'); setInvioTuttiMsg(''); }, 8000);
  }

  async function salvaEmail(prenotazioneId: string, email: string) {
    setEmailEditId(null);
    await fetch(`/api/prenotazioni/${prenotazioneId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ospite_email: email }),
    });
    setPrenotazioni(prev => prev.map(p => p.id === prenotazioneId ? { ...p, ospite_email: email } : p));
  }

  async function elimina(id: string) {
    if (!confirm('Eliminare questo alloggiato?')) return;
    await fetch(`/api/alloggiati/${id}`, { method: 'DELETE' });
    carica(data);
  }

  function esporta() {
    window.open(`/api/alloggiati/export?data=${data}`, '_blank');
  }

  async function inviaAlPortale() {
    setInvioPortale('loading');
    setInvioPortaleMsg('');
    try {
      const res = await fetch('/api/alloggiati/invia-portale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      const json = await res.json();
      if (json.ok) {
        setInvioPortale('ok');
        setInvioPortaleMsg(json.messaggio ?? 'Inviato!');
      } else {
        setInvioPortale('error');
        let msg = json.errore ?? 'Errore sconosciuto';
        if (json.diagnosi) {
          const righeInfo = (json.diagnosi as Array<{i:number;tipo:string;dataArrivo:string;permanenza:string;cognome:string;nome:string;sesso:string;dataNascita:string;statoNascita:string;comuneNascita:string;provNascita:string;cittadinanza:string;tipoDoc:string;numeroDoc:string;luogoRilascio:string;len:number;raw:string;db_comune_nascita:string;db_luogo_rilascio:string}>)
            .map(r => `[${r.i}] ${r.cognome} ${r.nome}\n  tipo:"${r.tipo}" dataArr:"${r.dataArrivo}" notti:"${r.permanenza}" dataNasc:"${r.dataNascita}" sesso:"${r.sesso}"\n  comune:"${r.comuneNascita}" prov:"${r.provNascita}" stato:"${r.statoNascita}"\n  citt:"${r.cittadinanza}" doc:"${r.tipoDoc}" numDoc:"${r.numeroDoc}" luogo:"${r.luogoRilascio}" len:${r.len}\n  db_comune:"${r.db_comune_nascita}" db_luogo:"${r.db_luogo_rilascio}"\n  RAW:${r.raw}`)
            .join('\n');
          msg += '\n\nDIAGNOSI:\n' + righeInfo;
          if (json.soapXml) msg += '\n\nSOAP:\n' + json.soapXml;
        }
        setInvioPortaleMsg(msg);
      }
    } catch {
      setInvioPortale('error');
      setInvioPortaleMsg('Errore di rete');
    }
    setTimeout(() => { setInvioPortale('idle'); setInvioPortaleMsg(''); }, 8000);
  }

  const dataLabel = format(parseISO(data), 'EEEE d MMMM yyyy', { locale: it });
  const eOggi = data === oggi;

  const prenotazioniIds = new Set(prenotazioni.map(p => p.id));
  const alloggiatiConPrenotazione = alloggiati.filter(a => a.prenotazione_id && prenotazioniIds.has(a.prenotazione_id));
  const alloggiatiSenzaPrenotazione = alloggiati.filter(a => !a.prenotazione_id || !prenotazioniIds.has(a.prenotazione_id));

  const prenotazioniCollegate = new Set(alloggiatiConPrenotazione.map(a => a.prenotazione_id));
  const numPrenotazioniCollegate = prenotazioniCollegate.size;

  function getNomeCamera(cameraId: number): string {
    const c = camere.find(c => c.id === cameraId);
    return c?.nome ?? `Camera ${cameraId}`;
  }

  function getCameraColor(cameraId: number): string {
    const c = camere.find(c => c.id === cameraId);
    return (c as { colore?: string } & typeof c)?.colore ?? '';
  }

  const prenotazioneAttuale = modal.prenotazioneId ? prenotazioni.find(p => p.id === modal.prenotazioneId) : null;

  return (
    <div className="space-y-5 pb-24 md:pb-6">

      {/* Titolo pagina */}
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
        <UserCheck size={22} className="text-blue-600" />
        Alloggiati
      </h1>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('alloggiati')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'alloggiati' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <UserCheck size={14} />
          Alloggiati
        </button>
        <button
          onClick={() => setTab('tassa')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'tassa' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Upload size={14} />
          Tassa di Soggiorno
        </button>
      </div>

      {tab === 'tassa' && <TassaSoggiorno />}

      {tab === 'alloggiati' && <>
      <div className="flex items-center justify-between">
        <div />
        <div className="flex gap-2 flex-wrap justify-end">
          {(() => {
            const registratiIds = new Set(alloggiati.map(a => a.prenotazione_id).filter(Boolean));
            const n = prenotazioni.filter(p => p.ospite_email && !registratiIds.has(p.id)).length;
            if (n === 0 && invioTutti === 'idle') return null;
            return (
              <button
                onClick={inviaLinkATutti}
                disabled={invioTutti === 'loading' || n === 0}
                className="flex items-center gap-1.5 border border-blue-300 bg-blue-50 text-blue-700 px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-100 disabled:opacity-60"
              >
                {invioTutti === 'loading'
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Mail size={14} />}
                <span className="hidden sm:inline">
                  {invioTutti === 'done'
                    ? invioTuttiMsg
                    : `Invia a tutti (${n})`}
                </span>
              </button>
            );
          })()}
          <button
            onClick={() => apriModal(null, null)}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Aggiungi</span>
          </button>
          <button
            onClick={esporta}
            className="flex items-center gap-1.5 border border-gray-300 bg-white px-3 py-1.5 rounded text-sm hover:bg-gray-50"
          >
            <Download size={15} />
            <span className="hidden sm:inline">Esporta</span>
          </button>
          <button
            onClick={inviaAlPortale}
            disabled={invioPortale === 'loading' || alloggiati.length === 0}
            title={invioPortale === 'error' ? invioPortaleMsg : 'Invia file al portale AlloggiatiWeb (Polizia di Stato)'}
            className={`flex items-center gap-1.5 border px-3 py-1.5 rounded text-sm disabled:opacity-50 ${
              invioPortale === 'ok'
                ? 'border-green-300 bg-green-50 text-green-700'
                : invioPortale === 'error'
                ? 'border-red-300 bg-red-50 text-red-700'
                : 'border-gray-300 bg-white hover:bg-gray-50'
            }`}
          >
            {invioPortale === 'loading'
              ? <Loader2 size={15} className="animate-spin" />
              : <Upload size={15} />}
            <span className="hidden sm:inline">
              {invioPortale === 'ok'
                ? '✓ Inviato'
                : invioPortale === 'error'
                ? '✗ Errore'
                : 'Portale'}
            </span>
          </button>
        </div>
      </div>

      {invioPortale === 'error' && invioPortaleMsg && (
        <pre className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700 whitespace-pre-wrap break-all overflow-auto max-h-48">
          {invioPortaleMsg}
        </pre>
      )}

      <div className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center justify-between gap-3">
        <button onClick={() => spostaDi(-1)} className="p-1.5 rounded hover:bg-gray-100">
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800 capitalize">{dataLabel}</span>
          {!eOggi && (
            <button
              onClick={() => setData(oggi)}
              className="text-xs text-blue-600 border border-blue-200 px-2 py-0.5 rounded hover:bg-blue-50"
            >
              Oggi
            </button>
          )}
        </div>
        <button onClick={() => spostaDi(1)} className="p-1.5 rounded hover:bg-gray-100">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm px-4 py-3 flex gap-6">
        <div>
          <div className="text-2xl font-bold text-gray-800">{alloggiati.length}</div>
          <div className="text-xs text-gray-400">alloggiati</div>
        </div>
        <div className="border-l border-gray-100 pl-6">
          <div className="text-2xl font-bold text-gray-800">{numPrenotazioniCollegate}</div>
          <div className="text-xs text-gray-400">prenotazioni collegate</div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-10">Caricamento...</div>
      ) : (
        <div className="space-y-3">
          {prenotazioni.length === 0 && alloggiati.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm py-12 text-center text-gray-400">
              Nessun arrivo in questa data
            </div>
          )}

          {prenotazioni.map(pren => {
            const style = getCameraStyle(pren.camera_id, getCameraColor(pren.camera_id));
            const ospiti = alloggiati.filter(a => a.prenotazione_id === pren.id);
            const nomeCam = getNomeCamera(pren.camera_id);
            return (
              <div key={pren.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div
                  className={`px-4 py-3 ${style.bg} border-b ${style.border}`}
                  style={{ borderLeft: `5px solid ${style.hex}` }}
                >
                  {/* Row 1: Name + camera badge + status */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-bold ${style.testo}`}>{pren.ospite_nome}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${style.leggero}`}>
                        {nomeCam}
                      </span>
                    </div>
                    {/* Check-in remote status badge */}
                    {(() => {
                      const s = checkinStatus[pren.id];
                      const count = ospiti.length;
                      if (count > 0) {
                        return (
                          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
                            <ClipboardCheck size={10} />
                            {count} doc. ricevut{count === 1 ? 'o' : 'i'}
                          </span>
                        );
                      }
                      if (s?.linkInviato) {
                        return (
                          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                            <Clock size={10} />
                            In attesa risposta
                          </span>
                        );
                      }
                      if (pren.ospite_email) {
                        return (
                          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                            <Mail size={10} />
                            Email da inviare
                          </span>
                        );
                      }
                      return (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">
                          Nessuna email
                        </span>
                      );
                    })()}
                  </div>

                  {/* Row 2: dates */}
                  <div className={`text-xs ${style.testo} opacity-60 mt-1`}>
                    check-in {pren.check_in} · check-out {pren.check_out}
                    {checkinStatus[pren.id]?.linkInviato && checkinStatus[pren.id]?.linkCreatedAt && (
                      <span className="ml-2 opacity-70">
                        · link inviato il {new Date(checkinStatus[pren.id].linkCreatedAt!).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {/* Row 3: email editable + action buttons */}
                  <div className="flex items-center justify-between mt-1.5 gap-2 flex-wrap">
                    <div>
                      {emailEditId === pren.id ? (
                        <input
                          type="email"
                          autoFocus
                          value={emailEditVal}
                          onChange={e => setEmailEditVal(e.target.value)}
                          onBlur={() => salvaEmail(pren.id, emailEditVal)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); salvaEmail(pren.id, emailEditVal); }
                            if (e.key === 'Escape') setEmailEditId(null);
                          }}
                          className="text-xs border border-blue-300 rounded px-1.5 py-0.5 w-48 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white text-gray-700"
                        />
                      ) : (
                        <button
                          onClick={() => { setEmailEditId(pren.id); setEmailEditVal(pren.ospite_email || ''); }}
                          className={`text-xs truncate max-w-[220px] ${pren.ospite_email ? 'text-blue-500 hover:text-blue-700' : 'text-gray-400 italic hover:text-gray-600'}`}
                        >
                          {pren.ospite_email || '+ email'}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {invioLink[pren.id] === 'error' && invioLinkMsg[pren.id] && (
                        <div className="text-[10px] text-red-600 max-w-[160px] text-right leading-tight">{invioLinkMsg[pren.id]}</div>
                      )}
                      {emailPrompt[pren.id] ? (
                        <form
                          onSubmit={e => { e.preventDefault(); inviaLink(pren.id, emailInput[pren.id]); }}
                          className="flex items-center gap-1"
                        >
                          <input
                            type="email"
                            autoFocus
                            required
                            placeholder="email ospite"
                            value={emailInput[pren.id] ?? ''}
                            onChange={e => setEmailInput(prev => ({ ...prev, [pren.id]: e.target.value }))}
                            className="border border-gray-300 rounded px-2 py-0.5 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-blue-300"
                          />
                          <button type="submit" className="text-xs px-2 py-0.5 rounded border border-blue-300 text-blue-600 bg-white hover:bg-blue-50">
                            Invia
                          </button>
                          <button type="button" onClick={() => setEmailPrompt(prev => ({ ...prev, [pren.id]: false }))} className="text-xs text-gray-400 hover:text-gray-600 px-1">
                            ✕
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              if (pren.ospite_email) {
                                inviaLink(pren.id);
                              } else {
                                setEmailPrompt(prev => ({ ...prev, [pren.id]: true }));
                              }
                            }}
                            disabled={invioLink[pren.id] === 'loading'}
                            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded border bg-white/70 hover:bg-white ${
                              checkinStatus[pren.id]?.linkInviato
                                ? 'border-amber-300 text-amber-700'
                                : 'border-gray-300 text-gray-600'
                            }`}
                          >
                            {invioLink[pren.id] === 'ok' ? (
                              <><Mail size={11} /> ✓ Inviato</>
                            ) : invioLink[pren.id] === 'error' ? (
                              '✗ Errore'
                            ) : invioLink[pren.id] === 'loading' ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : checkinStatus[pren.id]?.linkInviato ? (
                              <><SendHorizonal size={11} /> Reinvia email</>
                            ) : (
                              <><Mail size={11} /> Invia email</>
                            )}
                          </button>
                          {pren.ospite_telefono && (
                            <button
                              onClick={() => inviaLinkWhatsApp(pren.id, pren.ospite_telefono)}
                              disabled={invioWA[pren.id] === 'loading'}
                              title={`WhatsApp a ${pren.ospite_telefono}`}
                              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded border bg-white/70 hover:bg-white ${
                                invioWA[pren.id] === 'error'
                                  ? 'border-red-300 text-red-600'
                                  : 'border-green-300 text-green-700'
                              }`}
                            >
                              {invioWA[pren.id] === 'ok' ? (
                                <><MessageCircle size={11} /> ✓ Inviato</>
                              ) : invioWA[pren.id] === 'error' ? (
                                <span title={invioWAMsg[pren.id]}>✗ Errore</span>
                              ) : invioWA[pren.id] === 'loading' ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <><MessageCircle size={11} /> WhatsApp</>
                              )}
                            </button>
                          )}
                        </>
                      )}
                      <button
                        onClick={() => apriModal(pren.id, null)}
                        className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded border ${style.border} ${style.testo} bg-white/70 hover:bg-white`}
                      >
                        <Plus size={12} />
                        Ospite
                      </button>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {ospiti.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-gray-400 italic">Nessun ospite registrato</div>
                  ) : (
                    ospiti.map(a => (
                      <RigaAlloggiato
                        key={a.id}
                        a={a}
                        style={style}
                        onEdit={() => apriModal(pren.id, a)}
                        onDelete={() => elimina(a.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {alloggiatiSenzaPrenotazione.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <span className="text-sm font-semibold text-gray-600">Senza prenotazione</span>
                <button
                  onClick={() => apriModal(null, null)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-600 bg-white hover:bg-gray-50"
                >
                  <Plus size={12} />
                  Ospite
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {alloggiatiSenzaPrenotazione.map(a => (
                  <RigaAlloggiato
                    key={a.id}
                    a={a}
                    style={getCameraStyle(0)}
                    onEdit={() => apriModal(null, a)}
                    onDelete={() => elimina(a.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {prenotazioni.length === 0 && alloggiati.length > 0 && alloggiatiSenzaPrenotazione.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <span className="text-sm font-semibold text-gray-600">Alloggiati del giorno</span>
              </div>
              <div className="divide-y divide-gray-50">
                {alloggiati.map(a => (
                  <RigaAlloggiato
                    key={a.id}
                    a={a}
                    style={getCameraStyle(0)}
                    onEdit={() => apriModal(null, a)}
                    onDelete={() => elimina(a.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </>}

      {modal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col" style={{ maxHeight: 'calc(100dvh - 24px)' }}>

            {/* Header fisso */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="font-semibold text-gray-800 text-sm">
                  {modal.editing ? 'Modifica alloggiato' : 'Nuovo alloggiato'}
                </h2>
                {prenotazioneAttuale && (
                  <p className="text-xs text-gray-400">
                    {prenotazioneAttuale.ospite_nome} · {getNomeCamera(prenotazioneAttuale.camera_id)}
                  </p>
                )}
              </div>
              <button onClick={chiudiModal} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {/* Body scrollabile */}
            <form
              id="form-alloggiato"
              onSubmit={e => { e.preventDefault(); salva(); }}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) scanDocument(f); e.target.value = ''; }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-60"
              >
                {scanning
                  ? <><Loader2 size={15} className="animate-spin" /> Lettura in corso...</>
                  : <><ScanLine size={15} /> Scansiona CI / Passaporto</>
                }
              </button>
              {scanMsg && (
                <div className={`text-xs px-3 py-1.5 rounded ${scanMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {scanMsg.testo}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Tipo *</label>
                  <select value={form.tipo} onChange={e => setF('tipo', e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs" required>
                    {Object.entries(TIPI_ALLOGGIATO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Sesso *</label>
                  <select value={form.sesso} onChange={e => setF('sesso', e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs" required>
                    <option value="M">M</option>
                    <option value="F">F</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Cognome *</label>
                  <input type="text" value={form.cognome} onChange={e => setF('cognome', e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Nome *</label>
                  <input type="text" value={form.nome} onChange={e => setF('nome', e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs" required />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Data Nascita *</label>
                  <input type="date" value={form.data_nascita} onChange={e => setF('data_nascita', e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Data Arrivo *</label>
                  <input type="date" value={form.data_arrivo} onChange={e => setF('data_arrivo', e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Notti *</label>
                  <input type="number" min={1} value={form.permanenza} onChange={e => setF('permanenza', e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs" required />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">
                    Comune Nascita
                    <span className="text-gray-400 font-normal ml-1">(solo italiani)</span>
                  </label>
                  <input
                    type="text"
                    value={form.comune_nascita}
                    onChange={e => setF('comune_nascita', e.target.value)}
                    placeholder="PALERMO oppure codice ISTAT"
                    list="list-comuni-nascita"
                    className="w-full border rounded px-2 py-1.5 text-xs"
                  />
                  <datalist id="list-comuni-nascita">
                    {COMUNI.map(c => (
                      <option key={c.codice} value={c.nome}>{c.nome} ({c.prov})</option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Prov.</label>
                  <input type="text" value={form.provincia_nascita} onChange={e => setF('provincia_nascita', e.target.value)} maxLength={2} placeholder="PA" className="w-full border rounded px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">
                    Stato Nascita
                    <span className="text-gray-400 font-normal ml-1">(vuoto=Italia)</span>
                  </label>
                  <input
                    type="text"
                    value={form.stato_nascita}
                    onChange={e => setF('stato_nascita', e.target.value)}
                    placeholder="GERMANIA, FRANCIA…"
                    list="list-stati-nascita"
                    className="w-full border rounded px-2 py-1.5 text-xs"
                  />
                  <datalist id="list-stati-nascita">
                    {PAESI.map(p => (
                      <option key={p.codice} value={p.nome}>{p.nome}</option>
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Cittadinanza</label>
                  <input
                    type="text"
                    value={form.cittadinanza}
                    onChange={e => setF('cittadinanza', e.target.value)}
                    placeholder="ITALIANA, TEDESCA, FRANCESE…"
                    list="list-cittadinanza"
                    className="w-full border rounded px-2 py-1.5 text-xs"
                  />
                  <datalist id="list-cittadinanza">
                    <option value="ITALIANA">ITALIANA</option>
                    {PAESI.filter(p => p.codice).map(p => (
                      <option key={p.codice} value={p.nome}>{p.nome}</option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Tipo Doc.</label>
                  <select value={form.tipo_documento} onChange={e => setF('tipo_documento', e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs" required>
                    <option value="">— seleziona —</option>
                    <option value="PP">Passaporto</option>
                    <option value="CI">Carta d'Identità Elettronica (IT)</option>
                    <option value="ID">Carta d'Identità (stranieri)</option>
                    <option value="DL">Patente di Guida</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Luogo Rilascio</label>
                  <input
                    type="text"
                    value={form.luogo_rilascio}
                    onChange={e => setF('luogo_rilascio', e.target.value)}
                    placeholder="PALERMO (IT) o GERMANIA (straniero)"
                    list="list-comuni-rilascio"
                    className="w-full border rounded px-2 py-1.5 text-xs"
                  />
                  <datalist id="list-comuni-rilascio">
                    {COMUNI.map(c => (
                      <option key={c.codice} value={c.nome}>{c.nome} ({c.prov})</option>
                    ))}
                    {PAESI.map(p => (
                      <option key={`p-${p.codice}`} value={p.nome}>{p.nome}</option>
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Numero Documento</label>
                <input type="text" value={form.numero_documento} onChange={e => setF('numero_documento', e.target.value)} maxLength={20} className="w-full border rounded px-2 py-1.5 text-xs" />
              </div>

              {!modal.prenotazioneId && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Collega prenotazione (opzionale)</label>
                  <select value={form.prenotazione_id} onChange={e => setF('prenotazione_id', e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs">
                    <option value="">— Nessuna —</option>
                    {prenotazioni.map(p => (
                      <option key={p.id} value={p.id}>{p.ospite_nome} · {getNomeCamera(p.camera_id)} · {p.check_in}</option>
                    ))}
                  </select>
                </div>
              )}
            </form>

            {/* Footer fisso con bottoni */}
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-100 flex-shrink-0">
              <button type="button" onClick={chiudiModal} className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">
                Annulla
              </button>
              <button type="submit" form="form-alloggiato" disabled={saving} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RigaAlloggiato({
  a,
  style,
  onEdit,
  onDelete,
}: {
  a: Alloggiato;
  style: ReturnType<typeof getCameraStyle>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 py-2.5 pr-4 hover:bg-gray-50 transition-colors"
      style={{ borderLeft: `4px solid ${style.hex}`, paddingLeft: '14px' }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-800">{rigaLabel(a)}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${style.leggero}`}>
            {TIPI_ALLOGGIATO[a.tipo]}
          </span>
        </div>
        {a.tipo_documento && (
          <div className="text-xs text-gray-400 mt-0.5">
            {a.tipo_documento} · {a.numero_documento}
            {a.data_nascita && <span className="ml-2">n. {a.data_nascita}</span>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={onEdit} className="text-gray-300 hover:text-blue-500 transition-colors">
          <Pencil size={14} />
        </button>
        <button onClick={onDelete} className="text-gray-300 hover:text-red-500 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
