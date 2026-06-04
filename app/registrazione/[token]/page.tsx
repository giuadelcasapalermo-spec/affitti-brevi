'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { ScanLine, Loader2, CheckCircle, AlertCircle, UserPlus } from 'lucide-react';
import { TIPI_ALLOGGIATO, TipoAlloggiato } from '@/lib/types';

type Fase = 'caricamento' | 'form' | 'completato' | 'errore' | 'grazie';

const FORM_VUOTO = {
  tipo: '16' as TipoAlloggiato,
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
};

async function compressImage(file: File): Promise<File> {
  if (file.size < 1.5 * 1024 * 1024) return file;
  const compress = new Promise<File>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const MAX = 1400;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(url); resolve(file); return; }
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          blob => resolve(blob ? new File([blob], 'doc.jpg', { type: 'image/jpeg' }) : file),
          'image/jpeg',
          0.85
        );
      } catch {
        URL.revokeObjectURL(url);
        resolve(file);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
  // timeout di 6s: se canvas.toBlob non risponde (bug WebView Android) usa il file originale
  const timeout = new Promise<File>(resolve => setTimeout(() => resolve(file), 6000));
  return Promise.race([compress, timeout]);
}

export default function RegistrazionePage() {
  const { token } = useParams() as { token: string };

  const [fase, setFase] = useState<Fase>('caricamento');
  const [errore, setErrore] = useState('');
  const [nomeOspite, setNomeOspite] = useState('');
  const [dataArrivo, setDataArrivo] = useState('');
  const [permanenza, setPermanenza] = useState(1);
  const [form, setForm] = useState({ ...FORM_VUOTO });
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<{ ok: boolean; testo: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [ospiteCount, setOspiteCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/registrazione/${token}`)
      .then(r => r.json())
      .then(json => {
        if (json.errore) {
          setErrore(json.errore);
          setFase('errore');
        } else {
          setNomeOspite(json.nomeOspite);
          setDataArrivo(json.dataArrivo);
          setPermanenza(json.permanenza);
          setFase('form');
        }
      })
      .catch(() => {
        setErrore('Errore di rete. Riprova.');
        setFase('errore');
      });
  }, [token]);

  function setF(k: string, v: string | number) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function scanDocument(file: File) {
    setScanning(true);
    setScanMsg(null);
    try {
      // Limite 20 MB
      if (file.size > 20 * 1024 * 1024) {
        setScanMsg({ ok: false, testo: 'Immagine troppo grande (max 20 MB). Usa una foto con risoluzione minore.' });
        return;
      }
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append('immagine', compressed);
      // AbortController: annulla la richiesta dopo 25s (evita che il browser mostri "page couldn't load")
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      let res: Response;
      try {
        res = await fetch('/api/alloggiati/scan', { method: 'POST', body: fd, signal: ctrl.signal });
      } catch (fetchErr) {
        const isTimeout = fetchErr instanceof Error && fetchErr.name === 'AbortError';
        setScanMsg({ ok: false, testo: isTimeout ? 'Scansione scaduta (>25s). Riprova con una foto più nitida.' : 'Errore di rete. Riprova.' });
        return;
      } finally {
        clearTimeout(timer);
      }
      let json: Record<string, string>;
      try {
        json = await res.json();
      } catch {
        setScanMsg({ ok: false, testo: `Errore server (${res.status}). Riprova.` });
        return;
      }
      if (!res.ok || json.errore) {
        setScanMsg({ ok: false, testo: json.errore ?? `Errore ${res.status}` });
        return;
      }
      setForm(prev => ({
        ...prev,
        cognome:          json.cognome          || prev.cognome,
        nome:             json.nome             || prev.nome,
        sesso:            (json.sesso === 'M' || json.sesso === 'F') ? json.sesso : prev.sesso,
        data_nascita:     json.data_nascita     || prev.data_nascita,
        tipo_documento:   json.tipo_documento   || prev.tipo_documento,
        numero_documento: json.numero_documento || prev.numero_documento,
        stato_nascita:    json.codice_stato_nascita !== undefined ? json.codice_stato_nascita : prev.stato_nascita,
        cittadinanza:     json.codice_cittadinanza  || prev.cittadinanza,
        comune_nascita:   json.luogo_nascita_testo  || prev.comune_nascita,
        luogo_rilascio:   json.codice_luogo_rilascio || prev.luogo_rilascio,
      }));
      setScanMsg({ ok: true, testo: `Documento letto: ${json.cognome} ${json.nome}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
      setScanMsg({ ok: false, testo: `Errore: ${msg}` });
    } finally {
      setScanning(false);
      setTimeout(() => setScanMsg(null), 8000);
    }
  }

  async function conferma(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/registrazione/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.ok) {
        setOspiteCount(c => c + 1);
        setFase('completato');
      } else {
        setErrore(json.errore ?? 'Errore durante il salvataggio');
        setFase('errore');
      }
    } catch {
      setErrore('Errore di rete. Riprova.');
      setFase('errore');
    } finally {
      setSaving(false);
    }
  }

  function aggiungiAltroOspite() {
    setForm({ ...FORM_VUOTO });
    setScanMsg(null);
    setFase('form');
  }

  return (
    <div className="min-h-screen bg-blue-50">
      <header className="bg-white border-b border-blue-100 px-4 py-4 text-center">
        <h1 className="text-xl font-bold text-blue-700">Registrazione check-in</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        {fase === 'caricamento' && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-blue-600">
            <Loader2 size={32} className="animate-spin" />
            <span className="text-sm">Caricamento...</span>
          </div>
        )}

        {fase === 'errore' && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Link non disponibile</h2>
            <p className="text-sm text-gray-500">{errore}</p>
          </div>
        )}

        {fase === 'completato' && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center space-y-5">
            <CheckCircle size={40} className="text-green-500 mx-auto" />
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                {ospiteCount === 1 ? 'Ospite registrato!' : `${ospiteCount} ospiti registrati!`}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {ospiteCount === 1
                  ? 'Devi registrare altri ospiti dello stesso soggiorno?'
                  : 'Ci sono altri ospiti da registrare?'}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={aggiungiAltroOspite}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
              >
                <UserPlus size={16} />
                Aggiungi un altro ospite
              </button>
              <button
                onClick={() => setFase('grazie')}
                className="w-full border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium py-3 rounded-lg text-sm transition-colors"
              >
                Ho finito
              </button>
            </div>
          </div>
        )}

        {fase === 'grazie' && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <CheckCircle size={40} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Registrazione completata!</h2>
            <p className="text-sm text-gray-500">
              {ospiteCount > 1
                ? `${ospiteCount} ospiti registrati con successo. Grazie!`
                : 'Grazie. I tuoi dati sono stati registrati con successo.'}
            </p>
          </div>
        )}

        {fase === 'form' && (
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">
            {ospiteCount > 0 && (
              <div className="bg-blue-50 rounded-lg px-4 py-2 text-sm text-blue-700 font-medium">
                Ospite {ospiteCount + 1}
              </div>
            )}
            {ospiteCount === 0 && (
              <div>
                <p className="text-sm text-gray-600">
                  Gentile <strong>{nomeOspite}</strong>, compila il modulo per registrare i tuoi dati per il check-in del <strong>{dataArrivo}</strong>.
                </p>
              </div>
            )}

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
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg py-3 text-sm font-medium transition-colors disabled:opacity-60"
            >
              {scanning
                ? <><Loader2 size={16} className="animate-spin" /> Lettura in corso...</>
                : <><ScanLine size={16} /> Scansiona documento</>
              }
            </button>
            {scanMsg && (
              <div className={`text-xs px-3 py-2 rounded ${scanMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {scanMsg.testo}
              </div>
            )}

            <form onSubmit={conferma} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo alloggiato *</label>
                <select
                  value={form.tipo}
                  onChange={e => setF('tipo', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  required
                >
                  {Object.entries(TIPI_ALLOGGIATO).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cognome *</label>
                  <input
                    type="text"
                    value={form.cognome}
                    onChange={e => setF('cognome', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                  <input
                    type="text"
                    value={form.nome}
                    onChange={e => setF('nome', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sesso *</label>
                  <select
                    value={form.sesso}
                    onChange={e => setF('sesso', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    required
                  >
                    <option value="M">M</option>
                    <option value="F">F</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Data nascita *</label>
                  <input
                    type="date"
                    value={form.data_nascita}
                    onChange={e => setF('data_nascita', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Comune nascita</label>
                  <input
                    type="text"
                    value={form.comune_nascita}
                    onChange={e => setF('comune_nascita', e.target.value)}
                    placeholder="cod. o città"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Prov.</label>
                  <input
                    type="text"
                    value={form.provincia_nascita}
                    onChange={e => setF('provincia_nascita', e.target.value)}
                    maxLength={2}
                    placeholder="PA"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Stato nascita</label>
                <input
                  type="text"
                  value={form.stato_nascita}
                  onChange={e => setF('stato_nascita', e.target.value)}
                  placeholder="codice/nazione"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cittadinanza</label>
                <input
                  type="text"
                  value={form.cittadinanza}
                  onChange={e => setF('cittadinanza', e.target.value)}
                  placeholder="codice"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo documento</label>
                  <input
                    type="text"
                    value={form.tipo_documento}
                    onChange={e => setF('tipo_documento', e.target.value)}
                    maxLength={5}
                    placeholder="PP / CI"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Numero documento</label>
                  <input
                    type="text"
                    value={form.numero_documento}
                    onChange={e => setF('numero_documento', e.target.value)}
                    maxLength={20}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Luogo rilascio</label>
                <input
                  type="text"
                  value={form.luogo_rilascio}
                  onChange={e => setF('luogo_rilascio', e.target.value)}
                  placeholder="codice comune"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Data arrivo</label>
                  <input
                    type="date"
                    value={dataArrivo}
                    readOnly
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notti</label>
                  <input
                    type="number"
                    value={permanenza}
                    readOnly
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving
                  ? <><Loader2 size={16} className="animate-spin" /> Invio in corso...</>
                  : 'Conferma registrazione'
                }
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
