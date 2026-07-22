'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Uscita, CATEGORIE_USCITA, CategoriaUscita,
  Entrata, CATEGORIE_ENTRATA, CategoriaEntrata,
  ContoCorrente,
} from '@/lib/types';
import { useCamere } from '@/hooks/useCamere';
import { useStruttura } from '@/hooks/useStruttura';
import { fData } from '@/lib/utils';
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Euro, Wallet, FileSpreadsheet, Printer, Search } from 'lucide-react';
import VoiceInput from '@/components/VoiceInput';

/* ── colori ───────────────────────────────────────────── */
const COL_USCITA: Record<CategoriaUscita, string> = {
  Pulizie:      'bg-blue-100 text-blue-700',
  Utenze:       'bg-yellow-100 text-yellow-700',
  Manutenzione: 'bg-orange-100 text-orange-700',
  Forniture:    'bg-green-100 text-green-700',
  Arredamento:  'bg-cyan-100 text-cyan-700',
  Commissioni:  'bg-purple-100 text-purple-700',
  Pubblicità:   'bg-pink-100 text-pink-700',
  Affitto:      'bg-indigo-100 text-indigo-700',
  Tasse:        'bg-red-100 text-red-700',
  Altro:        'bg-gray-100 text-gray-600',
};
const COL_ENTRATA: Record<CategoriaEntrata, string> = {
  'Booking.com': 'bg-blue-100 text-blue-700',
  'Airbnb':      'bg-red-100 text-red-700',
  'Privato':     'bg-green-100 text-green-700',
  'Altro':       'bg-gray-100 text-gray-600',
};

const oggi = new Date().toISOString().split('T')[0];
const DEFAULT_DAL_PN = oggi.slice(0, 7) + '-01';
const DEFAULT_AL_PN = (() => {
  const [y, m] = oggi.slice(0, 7).split('-').map(Number);
  return `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
})();

/* ── riga unificata ───────────────────────────────────── */
type Riga =
  | { tipo: 'entrata'; rec: Entrata }
  | { tipo: 'uscita';  rec: Uscita  };

/* ── Form uscita ──────────────────────────────────────── */
function FormUscita({ iniziale, onSalva, onAnnulla, camere, contiCorrenti }: {
  iniziale?: Partial<Uscita>;
  onSalva: (d: Partial<Uscita>) => void;
  onAnnulla: () => void;
  camere: { id: number; nome: string }[];
  contiCorrenti: ContoCorrente[];
}) {
  const defaultFonte = contiCorrenti[0]?.nome ?? 'Contanti';
  const [f, setF] = useState({
    data:            iniziale?.data            ?? oggi,
    descrizione:     iniziale?.descrizione     ?? '',
    categoria:       iniziale?.categoria       ?? 'Altro' as CategoriaUscita,
    importo:         iniziale?.importo         ?? '',
    camera_id:       iniziale?.camera_id       ?? '',
    note:            iniziale?.note            ?? '',
    fonte_pagamento: iniziale?.fonte_pagamento ?? defaultFonte,
  });
  const set = (k: string, v: string | number) => setF(p => ({ ...p, [k]: v }));

  // Aggiorna la selezione quando la struttura carica e porta nuove modalità
  useEffect(() => {
    if (!iniziale?.fonte_pagamento) {
      const nomi = contiCorrenti.map(c => c.nome);
      if (!nomi.includes(f.fonte_pagamento)) {
        setF(p => ({ ...p, fonte_pagamento: contiCorrenti[0]?.nome ?? 'Contanti' }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contiCorrenti]);
  function applicaVoce(data: Record<string, unknown>) {
    setF(p => ({
      ...p,
      ...(data.data        ? { data:        String(data.data) }                          : {}),
      ...(data.descrizione ? { descrizione: String(data.descrizione) }                  : {}),
      ...(data.categoria   ? { categoria:   String(data.categoria) as CategoriaUscita } : {}),
      ...(data.importo != null ? { importo: String(data.importo) }                      : {}),
      ...(data.camera_id != null ? { camera_id: String(data.camera_id) }                : {}),
      ...(data.note != null ? { note: String(data.note) }                               : {}),
    }));
  }
  return (
    <form onSubmit={e => { e.preventDefault(); onSalva({ ...f, importo: Number(f.importo), camera_id: f.camera_id ? Number(f.camera_id) : undefined }); }} className="space-y-4">
      <VoiceInput tipo="uscita" camere={camere} onParsed={applicaVoce} />
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
          <input type="date" value={f.data} onChange={e => set('data', e.target.value)} className="w-full border rounded px-3 py-2 text-sm" required /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
          <select value={f.categoria} onChange={e => set('categoria', e.target.value)} className="w-full border rounded px-3 py-2 text-sm" required>
            {CATEGORIE_USCITA.map(c => <option key={c} value={c}>{c}</option>)}
          </select></div>
      </div>
      <div><label className="block text-sm font-medium text-gray-700 mb-1">Descrizione *</label>
        <input type="text" value={f.descrizione} onChange={e => set('descrizione', e.target.value)} className="w-full border rounded px-3 py-2 text-sm" required /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Importo (€) *</label>
          <input type="number" min="0" step="0.01" value={f.importo} onChange={e => set('importo', e.target.value)} className="w-full border rounded px-3 py-2 text-sm" required /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Modalità pagamento</label>
          <select value={f.fonte_pagamento} onChange={e => set('fonte_pagamento', e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
            {contiCorrenti.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Camera</label>
          <select value={f.camera_id} onChange={e => set('camera_id', e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
            <option value="">Generale</option>
            {camere.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
          <input type="text" value={f.note} onChange={e => set('note', e.target.value)} className="w-full border rounded px-3 py-2 text-sm" /></div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onAnnulla} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Annulla</button>
        <button type="submit" className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700">Salva uscita</button>
      </div>
    </form>
  );
}

/* ── Form entrata ─────────────────────────────────────── */
function FormEntrata({ iniziale, onSalva, onAnnulla, camere, contiCorrenti }: {
  iniziale?: Partial<Entrata>;
  onSalva: (d: Partial<Entrata>) => void;
  onAnnulla: () => void;
  camere: { id: number; nome: string }[];
  contiCorrenti: ContoCorrente[];
}) {
  const defaultFonte = contiCorrenti[0]?.nome ?? 'Contanti';
  const [f, setF] = useState({
    data:            iniziale?.data            ?? oggi,
    descrizione:     iniziale?.descrizione     ?? '',
    categoria:       iniziale?.categoria       ?? 'Altro' as CategoriaEntrata,
    importo:         iniziale?.importo         ?? '',
    camera_id:       iniziale?.camera_id       ?? '',
    note:            iniziale?.note            ?? '',
    fonte_pagamento: iniziale?.fonte_pagamento ?? defaultFonte,
  });
  const set = (k: string, v: string | number) => setF(p => ({ ...p, [k]: v }));

  // Aggiorna la selezione quando la struttura carica e porta nuove modalità
  useEffect(() => {
    if (!iniziale?.fonte_pagamento) {
      const nomi = contiCorrenti.map(c => c.nome);
      if (!nomi.includes(f.fonte_pagamento)) {
        setF(p => ({ ...p, fonte_pagamento: contiCorrenti[0]?.nome ?? 'Contanti' }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contiCorrenti]);
  function applicaVoce(data: Record<string, unknown>) {
    setF(p => ({
      ...p,
      ...(data.data        ? { data:        String(data.data) }                            : {}),
      ...(data.descrizione ? { descrizione: String(data.descrizione) }                    : {}),
      ...(data.categoria   ? { categoria:   String(data.categoria) as CategoriaEntrata }  : {}),
      ...(data.importo != null ? { importo: String(data.importo) }                        : {}),
      ...(data.camera_id != null ? { camera_id: String(data.camera_id) }                  : {}),
      ...(data.note != null ? { note: String(data.note) }                                 : {}),
    }));
  }
  return (
    <form onSubmit={e => { e.preventDefault(); onSalva({ ...f, importo: Number(f.importo), camera_id: f.camera_id ? Number(f.camera_id) : undefined }); }} className="space-y-4">
      <VoiceInput tipo="entrata" camere={camere} onParsed={applicaVoce} />
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
          <input type="date" value={f.data} onChange={e => set('data', e.target.value)} className="w-full border rounded px-3 py-2 text-sm" required /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Fonte incasso *</label>
          <select value={f.categoria} onChange={e => set('categoria', e.target.value)} className="w-full border rounded px-3 py-2 text-sm" required>
            {CATEGORIE_ENTRATA.map(c => <option key={c} value={c}>{c}</option>)}
          </select></div>
      </div>
      <div><label className="block text-sm font-medium text-gray-700 mb-1">Descrizione *</label>
        <input type="text" value={f.descrizione} onChange={e => set('descrizione', e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="es. Incasso Rossi" required /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Importo (€) *</label>
          <input type="number" min="0" step="0.01" value={f.importo} onChange={e => set('importo', e.target.value)} className="w-full border rounded px-3 py-2 text-sm" required /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Modalità pagamento</label>
          <select value={f.fonte_pagamento} onChange={e => set('fonte_pagamento', e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
            {contiCorrenti.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Camera</label>
          <select value={f.camera_id} onChange={e => set('camera_id', e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
            <option value="">Generale</option>
            {camere.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select></div>
      </div>
      <div><label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
        <input type="text" value={f.note} onChange={e => set('note', e.target.value)} className="w-full border rounded px-3 py-2 text-sm" /></div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onAnnulla} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Annulla</button>
        <button type="submit" className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700">Salva entrata</button>
      </div>
    </form>
  );
}

/* ── Pagina ───────────────────────────────────────────── */
export default function PrimaNotaPage() {
  const camere = useCamere();
  const { struttura } = useStruttura();
  const contiCorrenti: ContoCorrente[] = struttura?.conti_correnti?.length
    ? struttura.conti_correnti
    : [{ id: 'contanti-default', tipo: 'contanti', nome: 'Contanti' }];

  const [entrate, setEntrate] = useState<Entrata[]>([]);
  const [uscite, setUscite]   = useState<Uscita[]>([]);
  const [loading, setLoading] = useState(true);
  const [formAperto, setFormAperto] = useState<'entrata' | 'uscita' | null>(null);
  const [editingE, setEditingE] = useState<Entrata | null>(null);
  const [editingU, setEditingU] = useState<Uscita | null>(null);
  const [filtroDal, setFiltroDal] = useState(DEFAULT_DAL_PN);
  const [filtroAl,  setFiltroAl]  = useState(DEFAULT_AL_PN);
  const [filtriFiltriAperti, setFiltriFiltriAperti] = useState(false);
  const filtroModificato = filtroDal !== DEFAULT_DAL_PN || filtroAl !== DEFAULT_AL_PN;

  function spostaMese(delta: number) {
    const [y, m] = filtroDal.slice(0, 7).split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    setFiltroDal(`${ym}-01`);
    setFiltroAl(`${ym}-${String(last.getDate()).padStart(2, '0')}`);
  }
  const [sheetsAbilitato, setSheetsAbilitato] = useState(false);
  const [filtroE, setFiltroE] = useState<Set<string>>(new Set(CATEGORIE_ENTRATA));
  const [filtroU, setFiltroU] = useState<Set<string>>(new Set(CATEGORIE_USCITA));
  const [filtroFonti, setFiltroFonti] = useState<Set<string> | null>(null); // null = tutte
  const [filtroTesto, setFiltroTesto] = useState('');

  function toggleCatE(cat: string) {
    setFiltroE(prev => { const s = new Set(prev); s.has(cat) ? s.delete(cat) : s.add(cat); return s; });
  }
  function toggleCatU(cat: string) {
    setFiltroU(prev => { const s = new Set(prev); s.has(cat) ? s.delete(cat) : s.add(cat); return s; });
  }
  const tuttiE = filtroE.size === CATEGORIE_ENTRATA.length;
  const tuttiU = filtroU.size === CATEGORIE_USCITA.length;
  const filtroAttivo = !tuttiE || !tuttiU;

  const carica = useCallback(() => {
    Promise.all([
      fetch('/api/entrate').then(r => r.json()),
      fetch('/api/uscite').then(r => r.json()),
    ]).then(([e, u]) => {
      setEntrate(e as Entrata[]);
      setUscite(u as Uscita[]);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    carica();
    fetch('/api/settings').then(r => r.json()).then(d => setSheetsAbilitato(d.googleSheetsAbilitato ?? false));
  }, [carica]);

  /* CRUD — aggiornamento ottimistico: stato locale aggiornato subito, API in background */
  async function creaEntrata(d: Partial<Entrata>) {
    const id = crypto.randomUUID();
    const nuova: Entrata = {
      id,
      data: d.data!,
      descrizione: d.descrizione!,
      categoria: d.categoria as CategoriaEntrata,
      importo: Number(d.importo),
      camera_id: d.camera_id,
      note: d.note ?? '',
      fonte_pagamento: d.fonte_pagamento ?? 'Contanti',
      created_at: new Date().toISOString(),
    };
    setFormAperto(null);
    setEntrate(prev => [...prev, nuova]);
    fetch('/api/entrate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...d, id }) });
  }
  async function aggiornaEntrata(id: string, d: Partial<Entrata>) {
    setEditingE(null);
    setEntrate(prev => prev.map(e => e.id === id ? { ...e, ...d, importo: Number(d.importo ?? e.importo) } : e));
    fetch(`/api/entrate/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
  }
  async function eliminaEntrata(id: string) {
    if (!confirm('Eliminare questa entrata?')) return;
    setEntrate(prev => prev.filter(e => e.id !== id));
    fetch(`/api/entrate/${id}`, { method: 'DELETE' });
  }
  async function creaUscita(d: Partial<Uscita>) {
    const id = crypto.randomUUID();
    const nuova: Uscita = {
      id,
      data: d.data!,
      descrizione: d.descrizione!,
      categoria: d.categoria as CategoriaUscita,
      importo: Number(d.importo),
      camera_id: d.camera_id,
      note: d.note ?? '',
      fonte_pagamento: d.fonte_pagamento ?? 'Contanti',
      created_at: new Date().toISOString(),
    };
    setFormAperto(null);
    setUscite(prev => [...prev, nuova]);
    fetch('/api/uscite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...d, id }) });
  }
  async function aggiornaUscita(id: string, d: Partial<Uscita>) {
    setEditingU(null);
    setUscite(prev => prev.map(u => u.id === id ? { ...u, ...d, importo: Number(d.importo ?? u.importo) } : u));
    fetch(`/api/uscite/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
  }
  async function eliminaUscita(id: string) {
    if (!confirm('Eliminare questa uscita?')) return;
    setUscite(prev => prev.filter(u => u.id !== id));
    fetch(`/api/uscite/${id}`, { method: 'DELETE' });
  }

  /* Fonti disponibili nel periodo (per filtro e totali) */
  const fontiDisponibili: string[] = Array.from(new Set([
    ...entrate.filter(e => e.data >= filtroDal && e.data <= filtroAl).map(e => e.fonte_pagamento || 'Contanti'),
    ...uscite.filter(u => u.data >= filtroDal && u.data <= filtroAl).map(u => u.fonte_pagamento || 'Contanti'),
  ])).sort();
  const fontiAttive = filtroFonti ?? new Set(fontiDisponibili);
  const filtroFonteAttivo = filtroFonti !== null && filtroFonti.size < fontiDisponibili.length;

  /* Totali per modalità (rispettano filtri categorie e periodo, ignora filtro fonte per mostrare il quadro completo) */
  const totaliPerFonte = fontiDisponibili.map(fonte => {
    const totE = entrate.filter(e => e.data >= filtroDal && e.data <= filtroAl && filtroE.has(e.categoria) && (e.fonte_pagamento || 'Contanti') === fonte).reduce((s, e) => s + e.importo, 0);
    const totU = uscite.filter(u => u.data >= filtroDal && u.data <= filtroAl && filtroU.has(u.categoria) && (u.fonte_pagamento || 'Contanti') === fonte).reduce((s, u) => s + u.importo, 0);
    return { fonte, totE, totU, saldo: totE - totU };
  }).filter(t => t.totE > 0 || t.totU > 0);

  /* Lista unificata ordinata per data desc */
  const testoRicerca = filtroTesto.trim().toLowerCase();
  const righe: Riga[] = [
    ...entrate.filter(e => e.data >= filtroDal && e.data <= filtroAl && filtroE.has(e.categoria) && fontiAttive.has(e.fonte_pagamento || 'Contanti') && (!testoRicerca || e.descrizione?.toLowerCase().includes(testoRicerca))).map(e => ({ tipo: 'entrata' as const, rec: e })),
    ...uscite.filter(u => u.data >= filtroDal && u.data <= filtroAl && filtroU.has(u.categoria) && fontiAttive.has(u.fonte_pagamento || 'Contanti') && (!testoRicerca || u.descrizione?.toLowerCase().includes(testoRicerca))).map(u => ({ tipo: 'uscita' as const, rec: u })),
  ].sort((a, b) => b.rec.data.localeCompare(a.rec.data));

  /* KPI */
  const totEntrate = righe.filter(r => r.tipo === 'entrata').reduce((s, r) => s + r.rec.importo, 0);
  const totUscite  = righe.filter(r => r.tipo === 'uscita').reduce((s, r) => s + r.rec.importo, 0);
  const saldo      = totEntrate - totUscite;

  /* Saldo progressivo */
  const righeCrono = [...righe].reverse();
  let saldoCorrente = 0;
  const saldoMap = new Map<string, number>();
  for (const r of righeCrono) {
    saldoCorrente += r.tipo === 'entrata' ? r.rec.importo : -r.rec.importo;
    saldoMap.set(r.rec.id, saldoCorrente);
  }

  function scaricaExcel() {
    const intestazioni = ['Data', 'Tipo', 'Descrizione', 'Categoria', 'Modalità', 'Entrata (€)', 'Uscita (€)', 'Saldo (€)'];
    const righeCSV = righe.map((r, i) => {
      const isE = r.tipo === 'entrata';
      const s = saldoMap.get(r.rec.id) ?? 0;
      return [
        r.rec.data,
        isE ? 'Entrata' : 'Uscita',
        r.rec.descrizione,
        isE ? (r.rec as Entrata).categoria : (r.rec as Uscita).categoria,
        r.rec.fonte_pagamento || 'Contanti',
        isE ? r.rec.importo.toFixed(2) : '',
        !isE ? r.rec.importo.toFixed(2) : '',
        s.toFixed(2),
      ];
    });
    // Riga totali
    righeCSV.push(['', '', 'TOTALI', '', '', totEntrate.toFixed(2), totUscite.toFixed(2), saldo.toFixed(2)]);
    const csv = [intestazioni, ...righeCSV]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `prima-nota_${filtroDal}_${filtroAl}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  if (loading) return <div className="text-gray-400 py-10 text-center">Caricamento...</div>;

  return (
    <div className="space-y-5">

      {/* Riga 1: titolo + pulsanti a destra */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Prima Nota</h1>
        <div className="flex gap-2 no-print">
          <button onClick={scaricaExcel} title="Esporta Excel"
            className="flex items-center gap-1.5 border border-gray-300 bg-white text-gray-700 px-2.5 py-1.5 rounded text-sm font-medium hover:bg-gray-50"
          >
            <FileSpreadsheet size={15} className="text-green-600" />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button onClick={() => window.print()} title="Stampa / Salva PDF"
            className="flex items-center gap-1.5 border border-gray-300 bg-white text-gray-700 px-2.5 py-1.5 rounded text-sm font-medium hover:bg-gray-50"
          >
            <Printer size={15} className="text-gray-500" />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button
            onClick={() => setFormAperto(f => f === 'entrata' ? null : 'entrata')}
            className="flex items-center gap-1.5 bg-green-600 text-white px-2.5 py-1.5 rounded text-sm font-medium hover:bg-green-700 sm:px-4 sm:py-2"
          >
            <Plus size={15} /><span className="hidden sm:inline">Entrata</span>
          </button>
          <button
            onClick={() => setFormAperto(f => f === 'uscita' ? null : 'uscita')}
            className="flex items-center gap-1.5 bg-red-600 text-white px-2.5 py-1.5 rounded text-sm font-medium hover:bg-red-700 sm:px-4 sm:py-2"
          >
            <Plus size={15} /><span className="hidden sm:inline">Uscita</span>
          </button>
        </div>
      </div>

      {/* KPI mobile compatto */}
      <div className="sm:hidden bg-white rounded-lg shadow-sm px-4 py-3 grid grid-cols-3 divide-x divide-gray-100">
        <div className="text-center">
          <div className="text-[11px] text-gray-400">Entrate</div>
          <div className="text-base font-bold text-green-700">+€{totEntrate.toFixed(0)}</div>
          {totaliPerFonte.length > 1 && totaliPerFonte.map(t => (
            <div key={t.fonte} className="text-[9px] text-gray-400 leading-tight">{t.fonte}: +€{t.totE.toFixed(0)}</div>
          ))}
        </div>
        <div className="text-center">
          <div className="text-[11px] text-gray-400">Uscite</div>
          <div className="text-base font-bold text-red-600">-€{totUscite.toFixed(0)}</div>
          {totaliPerFonte.length > 1 && totaliPerFonte.map(t => (
            <div key={t.fonte} className="text-[9px] text-gray-400 leading-tight">{t.fonte}: -€{t.totU.toFixed(0)}</div>
          ))}
        </div>
        <div className="text-center">
          <div className="text-[11px] text-gray-400">Saldo</div>
          <div className={`text-base font-bold ${saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>{saldo >= 0 ? '+' : ''}€{saldo.toFixed(0)}</div>
          {totaliPerFonte.length > 1 && totaliPerFonte.map(t => (
            <div key={t.fonte} className={`text-[9px] leading-tight ${t.saldo >= 0 ? 'text-green-600' : 'text-red-500'}`}>{t.fonte}: {t.saldo >= 0 ? '+' : ''}€{t.saldo.toFixed(0)}</div>
          ))}
        </div>
      </div>

      {/* KPI cards desktop */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-start gap-3">
          <div className="bg-green-100 rounded-full p-2 shrink-0 mt-0.5"><TrendingUp size={20} className="text-green-600" /></div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-500">Entrate</div>
            <div className="text-lg font-bold text-green-700">+€{totEntrate.toFixed(2)}</div>
            {totaliPerFonte.length > 1 && (
              <div className="mt-1 space-y-0.5">
                {totaliPerFonte.map(t => t.totE > 0 && (
                  <div key={t.fonte} className="flex justify-between text-xs text-gray-400">
                    <span>{t.fonte}</span><span className="text-green-600">+€{t.totE.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-start gap-3">
          <div className="bg-red-100 rounded-full p-2 shrink-0 mt-0.5"><TrendingDown size={20} className="text-red-600" /></div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-500">Uscite</div>
            <div className="text-lg font-bold text-red-600">-€{totUscite.toFixed(2)}</div>
            {totaliPerFonte.length > 1 && (
              <div className="mt-1 space-y-0.5">
                {totaliPerFonte.map(t => t.totU > 0 && (
                  <div key={t.fonte} className="flex justify-between text-xs text-gray-400">
                    <span>{t.fonte}</span><span className="text-red-500">-€{t.totU.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className={`rounded-lg shadow-sm p-4 flex items-start gap-3 ${saldo >= 0 ? 'bg-white' : 'bg-red-50'}`}>
          <div className={`rounded-full p-2 shrink-0 mt-0.5 ${saldo >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
            <Euro size={20} className={saldo >= 0 ? 'text-green-600' : 'text-red-600'} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-500">Saldo</div>
            <div className={`text-lg font-bold ${saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>{saldo >= 0 ? '+' : ''}€{saldo.toFixed(2)}</div>
            {totaliPerFonte.length > 1 && (
              <div className="mt-1 space-y-0.5">
                {totaliPerFonte.map(t => (
                  <div key={t.fonte} className="flex justify-between text-xs text-gray-400">
                    <span>{t.fonte}</span>
                    <span className={t.saldo >= 0 ? 'text-green-600' : 'text-red-500'}>{t.saldo >= 0 ? '+' : ''}€{t.saldo.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filtro periodo + modalità */}
      <div className="bg-white rounded-lg shadow-sm p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => spostaMese(-1)} className="p-1 rounded hover:bg-gray-100" title="Mese precedente"><ChevronLeft size={16} /></button>
          <div className="flex items-center gap-1">
            <input type="date" value={filtroDal} onChange={e => setFiltroDal(e.target.value)} className="border rounded px-1.5 py-1 text-xs" />
            <span className="text-gray-400 text-xs">→</span>
            <input type="date" value={filtroAl}  onChange={e => setFiltroAl(e.target.value)}  className="border rounded px-1.5 py-1 text-xs" />
          </div>
          <button onClick={() => spostaMese(1)} className="p-1 rounded hover:bg-gray-100" title="Mese successivo"><ChevronRight size={16} /></button>
          {filtroModificato && (
            <button onClick={() => { setFiltroDal(DEFAULT_DAL_PN); setFiltroAl(DEFAULT_AL_PN); }} className="text-xs text-blue-600 hover:underline">
              Mese corrente
            </button>
          )}
          {fontiDisponibili.length > 0 && (
            <>
              <span className="text-gray-200 hidden sm:inline">|</span>
              <div className="flex items-center gap-1">
                <Wallet size={12} className="text-gray-400 shrink-0" />
                <select
                  value={filtroFonteAttivo ? Array.from(fontiAttive)[0] ?? '' : ''}
                  onChange={e => setFiltroFonti(e.target.value ? new Set([e.target.value]) : null)}
                  className="border rounded px-1.5 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="">Tutte le modalità</option>
                  {fontiDisponibili.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </>
          )}
          <span className="text-gray-200 hidden sm:inline">|</span>
          <div className="flex items-center gap-1">
            <Search size={12} className="text-gray-400 shrink-0" />
            <input
              type="text"
              value={filtroTesto}
              onChange={e => setFiltroTesto(e.target.value)}
              placeholder="Cerca descrizione..."
              className="border rounded px-1.5 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400 w-36"
            />
          </div>
        </div>
      </div>

      {/* Contenuto movimenti */}
      <>

      {/* Filtri */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <button
          onClick={() => setFiltriFiltriAperti(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filtri</span>
            {(filtroAttivo || filtroFonteAttivo) && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">attivi</span>}
          </div>
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${filtriFiltriAperti ? 'rotate-180' : ''}`} />
        </button>

        {filtriFiltriAperti && (
          <div className="px-4 pb-4 space-y-2.5 border-t border-gray-100">
            <div className="flex justify-end pt-2">
              {(filtroAttivo || filtroFonteAttivo) && (
                <button
                  onClick={() => { setFiltroE(new Set(CATEGORIE_ENTRATA)); setFiltroU(new Set(CATEGORIE_USCITA)); setFiltroFonti(null); }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Azzera filtri
                </button>
              )}
            </div>

            {/* Modalità pagamento */}
            {fontiDisponibili.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400 w-14 shrink-0">Modalità</span>
                <button
                  onClick={() => setFiltroFonti(null)}
                  className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${!filtroFonteAttivo ? 'border-gray-300 text-gray-500 hover:bg-gray-50' : 'border-blue-400 text-blue-600 bg-blue-50'}`}
                >
                  {filtroFonteAttivo ? 'Seleziona tutte' : 'Tutte'}
                </button>
                {fontiDisponibili.map(fonte => {
                  const attiva = fontiAttive.has(fonte);
                  return (
                    <button key={fonte}
                      onClick={() => {
                        const ns = new Set(fontiAttive);
                        ns.has(fonte) ? ns.delete(fonte) : ns.add(fonte);
                        setFiltroFonti(ns.size === fontiDisponibili.length ? null : ns);
                      }}
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 transition-opacity ${attiva ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400 line-through'}`}
                    >
                      <Wallet size={9} />{fonte}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Entrate */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 w-14 shrink-0">Entrate</span>
              <button
                onClick={() => setFiltroE(tuttiE ? new Set() : new Set(CATEGORIE_ENTRATA))}
                className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${tuttiE ? 'border-gray-300 text-gray-500 hover:bg-gray-50' : 'border-blue-400 text-blue-600 bg-blue-50'}`}
              >
                {tuttiE ? 'Deseleziona tutti' : 'Seleziona tutti'}
              </button>
              {CATEGORIE_ENTRATA.map(cat => {
                const attivo = filtroE.has(cat);
                return (
                  <button key={cat} onClick={() => toggleCatE(cat)}
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-opacity ${attivo ? COL_ENTRATA[cat] : 'bg-gray-100 text-gray-400 line-through'}`}
                  >{cat}</button>
                );
              })}
            </div>

            {/* Uscite */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 w-14 shrink-0">Uscite</span>
              <button
                onClick={() => setFiltroU(tuttiU ? new Set() : new Set(CATEGORIE_USCITA))}
                className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${tuttiU ? 'border-gray-300 text-gray-500 hover:bg-gray-50' : 'border-blue-400 text-blue-600 bg-blue-50'}`}
              >
                {tuttiU ? 'Deseleziona tutti' : 'Seleziona tutti'}
              </button>
              {CATEGORIE_USCITA.map(cat => {
                const attivo = filtroU.has(cat);
                return (
                  <button key={cat} onClick={() => toggleCatU(cat)}
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-opacity ${attivo ? COL_USCITA[cat] : 'bg-gray-100 text-gray-400 line-through'}`}
                  >{cat}</button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Form nuova entrata */}
      {formAperto === 'entrata' && (
        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-green-500">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-700">Nuova entrata</h2>
            <button onClick={() => setFormAperto(null)}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
          </div>
          <FormEntrata onSalva={creaEntrata} onAnnulla={() => setFormAperto(null)} camere={camere} contiCorrenti={contiCorrenti} />
        </div>
      )}

      {/* Form nuova uscita */}
      {formAperto === 'uscita' && (
        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-red-500">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-700">Nuova uscita</h2>
            <button onClick={() => setFormAperto(null)}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
          </div>
          <FormUscita onSalva={creaUscita} onAnnulla={() => setFormAperto(null)} camere={camere} contiCorrenti={contiCorrenti} />
        </div>
      )}

      {/* Form modifica */}
      {editingE && (
        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-yellow-400">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-700">Modifica entrata</h2>
            <button onClick={() => setEditingE(null)}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
          </div>
          <FormEntrata iniziale={editingE} onSalva={d => aggiornaEntrata(editingE.id, d)} onAnnulla={() => setEditingE(null)} camere={camere} contiCorrenti={contiCorrenti} />
        </div>
      )}
      {editingU && (
        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-yellow-400">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-700">Modifica uscita</h2>
            <button onClick={() => setEditingU(null)}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
          </div>
          <FormUscita iniziale={editingU} onSalva={d => aggiornaUscita(editingU.id, d)} onAnnulla={() => setEditingU(null)} camere={camere} contiCorrenti={contiCorrenti} />
        </div>
      )}

      {/* Lista unificata — mobile */}
      <div className="sm:hidden bg-white rounded-lg shadow-sm divide-y divide-gray-100">
        {righe.length === 0 ? (
          <div className="text-center text-gray-400 py-10">Nessun movimento registrato</div>
        ) : (
          <>
            {righe.map(r => {
              const s = saldoMap.get(r.rec.id) ?? 0;
              const isE = r.tipo === 'entrata';
              const e = r.rec as Entrata;
              const u = r.rec as Uscita;
              return (
                <div key={r.rec.id} className={`flex items-center gap-2 px-3 py-2 border-l-2 ${isE ? 'border-l-green-400' : 'border-l-red-400'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-gray-400 whitespace-nowrap">{fData(r.rec.data)}</span>
                      {isE
                        ? <span className={`text-[10px] px-1.5 py-0 rounded-full font-medium ${COL_ENTRATA[e.categoria]}`}>{e.categoria}</span>
                        : <span className={`text-[10px] px-1.5 py-0 rounded-full font-medium ${COL_USCITA[u.categoria]}`}>{u.categoria}</span>
                      }
                      {r.rec.fonte_pagamento && r.rec.fonte_pagamento !== 'Contanti' && (
                        <span className="text-[10px] px-1.5 py-0 rounded-full bg-gray-100 text-gray-500 flex items-center gap-0.5">
                          <Wallet size={8} />{r.rec.fonte_pagamento}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-medium text-gray-800 truncate">{r.rec.descrizione}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-bold ${isE ? 'text-green-700' : 'text-red-600'}`}>
                      {isE ? '+' : '-'}€{r.rec.importo.toFixed(2)}
                    </div>
                    <div className={`text-[10px] font-medium ${s >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {s >= 0 ? '+' : ''}€{s.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => isE ? setEditingE(e) : setEditingU(u)} className="text-gray-300 hover:text-blue-600"><Pencil size={13} /></button>
                    <button onClick={() => isE ? eliminaEntrata(e.id) : eliminaUscita(u.id)} className="text-gray-300 hover:text-red-600"><Trash2 size={13} /></button>
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between px-3 py-2 bg-gray-50 text-xs font-semibold">
              <span className="text-gray-600">Totale mese</span>
              <div className="flex gap-3">
                <span className="text-green-700">+€{totEntrate.toFixed(2)}</span>
                <span className="text-red-600">-€{totUscite.toFixed(2)}</span>
                <span className={saldo >= 0 ? 'text-green-700' : 'text-red-700'}>{saldo >= 0 ? '+' : ''}€{saldo.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Lista unificata — desktop */}
      <div className="hidden sm:block bg-white rounded-lg shadow-sm overflow-x-auto">
        {righe.length === 0 ? (
          <div className="text-center text-gray-400 py-12">Nessun movimento registrato</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Descrizione</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Categoria</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Modalità</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Entrata</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Uscita</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Saldo</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {righe.map(r => {
                const s = saldoMap.get(r.rec.id) ?? 0;
                const isE = r.tipo === 'entrata';
                const e = r.rec as Entrata;
                const u = r.rec as Uscita;
                return (
                  <tr key={r.rec.id} className={`border-b hover:bg-gray-50 ${isE ? 'border-l-2 border-l-green-300' : 'border-l-2 border-l-red-300'}`}>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fData(r.rec.data)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{r.rec.descrizione}</div>
                      {r.rec.note && <div className="text-xs text-gray-400">{r.rec.note}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {isE
                        ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COL_ENTRATA[e.categoria]}`}>{e.categoria}</span>
                        : <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COL_USCITA[u.categoria]}`}>{u.categoria}</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Wallet size={11} />
                        {r.rec.fonte_pagamento || 'Contanti'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">{isE ? `+€${r.rec.importo.toFixed(2)}` : ''}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">{!isE ? `-€${r.rec.importo.toFixed(2)}` : ''}</td>
                    <td className={`px-4 py-3 text-right font-bold ${s >= 0 ? 'text-green-700' : 'text-red-700'}`}>{s >= 0 ? '+' : ''}€{s.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => isE ? setEditingE(e) : setEditingU(u)} className="text-gray-400 hover:text-blue-600"><Pencil size={15} /></button>
                        <button onClick={() => isE ? eliminaEntrata(e.id) : eliminaUscita(u.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 font-semibold">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-gray-600">Totale mese</td>
                <td className="px-4 py-3 text-right text-green-700">+€{totEntrate.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-red-600">-€{totUscite.toFixed(2)}</td>
                <td className={`px-4 py-3 text-right font-bold ${saldo >= 0 ? 'text-green-700' : 'text-red-700'}`}>{saldo >= 0 ? '+' : ''}€{saldo.toFixed(2)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      </>
    </div>
  );
}
