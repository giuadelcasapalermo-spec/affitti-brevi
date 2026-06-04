'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { Prenotazione, Uscita, Entrata, CATEGORIE_USCITA, CATEGORIE_ENTRATA } from '@/lib/types';
import { useCamere } from '@/hooks/useCamere';
import { isWithinInterval, parseISO, differenceInDays, format, startOfMonth, endOfMonth, addMonths, subMonths, addDays } from 'date-fns';
import { fData } from '@/lib/utils';
import { BedDouble, Euro, Users, RefreshCw, TrendingDown, TrendingUp, ChevronLeft, ChevronRight, BookOpen, BarChart2, FileSpreadsheet, Printer } from 'lucide-react';
import { getCameraStyle } from '@/lib/camera-colors';
import { ComposedChart, Bar, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';


const COLORI_CAT_USCITA: Record<string, { bar: string; hex: string }> = {
  'Pulizie':      { bar: 'bg-sky-500',     hex: '#0ea5e9' },
  'Utenze':       { bar: 'bg-yellow-500',  hex: '#eab308' },
  'Manutenzione': { bar: 'bg-orange-500',  hex: '#f97316' },
  'Forniture':    { bar: 'bg-emerald-500', hex: '#10b981' },
  'Arredamento':  { bar: 'bg-violet-500',  hex: '#8b5cf6' },
  'Commissioni':  { bar: 'bg-pink-500',    hex: '#ec4899' },
  'Tasse':        { bar: 'bg-red-500',     hex: '#ef4444' },
  'Pubblicità':   { bar: 'bg-indigo-500',  hex: '#6366f1' },
  'Affitto':      { bar: 'bg-teal-500',    hex: '#14b8a6' },
  'Altro':        { bar: 'bg-gray-400',    hex: '#9ca3af' },
};

const COLORI_CAT_ENTRATA: Record<string, { bar: string; hex: string }> = {
  'Booking.com': { bar: 'bg-blue-600',  hex: '#2563eb' },
  'Airbnb':      { bar: 'bg-rose-500',  hex: '#f43f5e' },
  'Privato':     { bar: 'bg-green-600', hex: '#16a34a' },
  'Altro':       { bar: 'bg-gray-400',  hex: '#9ca3af' },
};

function isCameraOccupata(prenotazioni: Prenotazione[], cameraId: number): Prenotazione | null {
  const oggi = new Date();
  return (
    prenotazioni.find(
      (p) =>
        p.camera_id === cameraId &&
        p.stato === 'confermata' &&
        isWithinInterval(oggi, {
          start: parseISO(p.check_in),
          end: parseISO(p.check_out),
        })
    ) ?? null
  );
}

const oggi = new Date();
const DEFAULT_DAL = format(startOfMonth(oggi), 'yyyy-MM-dd');
const DEFAULT_AL = format(endOfMonth(oggi), 'yyyy-MM-dd');

export default function Dashboard() {
  const camere = useCamere();
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([]);
  const [uscite, setUscite] = useState<Uscita[]>([]);
  const [entrate, setEntrate] = useState<Entrata[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncOk, setSyncOk]   = useState<boolean | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const [filtroDal, setFiltroDal] = usePersistedState('dash-dal', DEFAULT_DAL);
  const [filtroAl, setFiltroAl]   = usePersistedState('dash-al',  DEFAULT_AL);
  const [filtroCamera, setFiltroCamera] = usePersistedState<number | 'tutte'>('dash-camera', 'tutte');
  const [sezione, setSezione] = usePersistedState<'camere' | 'prima_nota'>('dash-sezione', 'camere');

  const carica = useCallback(() => {
    fetch('/api/prenotazioni')
      .then((r) => r.json())
      .then((data) => { setPrenotazioni(data); setLoading(false); });
    fetch('/api/uscite').then((r) => r.json()).then(setUscite);
    fetch('/api/entrate').then((r) => r.json()).then(setEntrate);
  }, []);

  const syncIcal = useCallback(async () => {
    setSyncing(true);
    setSyncOk(null);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const json = await res.json();
      const ok = json.ok !== false;
      setSyncOk(ok);
      const totIcal = (json.risultati ?? []).reduce((s: number, r: { aggiunte: number }) => s + r.aggiunte, 0);
      const arricchite = json.prenotazioniArricchite ?? 0;
      let msg = `iCal: +${totIcal}`;
      if (!json.sheetsConfigurato) msg += ' · Sheet: non configurato';
      else if (json.sheetsErrore) msg += ` · Sheet errore: ${json.sheetsErrore}`;
      else msg += ` · Sheet: ${arricchite} aggiornate`;
      setSyncMsg(msg);
      carica();
    } catch {
      setSyncOk(false);
      setSyncMsg('Errore di rete');
    } finally {
      setSyncing(false);
      setTimeout(() => { setSyncOk(null); setSyncMsg(null); }, 6000);
    }
  }, [carica]);

  useEffect(() => {
    carica();
    const timer = setInterval(syncIcal, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [carica, syncIcal]);

  function spostaMese(delta: number) {
    const base = parseISO(filtroDal);
    const nuova = delta > 0 ? addMonths(base, 1) : subMonths(base, 1);
    setFiltroDal(format(startOfMonth(nuova), 'yyyy-MM-dd'));
    setFiltroAl(format(endOfMonth(nuova), 'yyyy-MM-dd'));
  }

  const filtroAttivo = filtroDal !== DEFAULT_DAL || filtroAl !== DEFAULT_AL || filtroCamera !== 'tutte';

  const prenNelPeriodo = prenotazioni.filter(
    (p) =>
      p.stato === 'confermata' &&
      p.check_in <= filtroAl &&
      p.check_out >= filtroDal &&
      (filtroCamera === 'tutte' || p.camera_id === filtroCamera)
  );

  const usciteDelPeriodo = uscite
    .filter((u) => u.data >= filtroDal && u.data <= filtroAl)
    .reduce((s, u) => s + u.importo, 0);

  const entrateEffettive = entrate
    .filter((e) => e.data >= filtroDal && e.data <= filtroAl)
    .reduce((s, e) => s + e.importo, 0);

  const entrateDelPeriodo = prenNelPeriodo
    .filter((p) => p.importo_totale > 0 && p.check_in >= filtroDal && p.check_in <= filtroAl)
    .reduce((sum, p) => sum + p.importo_totale, 0);

  const totalOspiti = prenNelPeriodo.filter(
    (p) => p.check_in >= filtroDal && p.check_in <= filtroAl
  ).length;

  const camereImpegnate = camere.filter((c) =>
    prenNelPeriodo.some((p) => p.camera_id === c.id)
  );

  function nottiInPeriodo(p: Prenotazione): number {
    const fineEsclusiva = format(addDays(parseISO(filtroAl), 1), 'yyyy-MM-dd');
    const ci = p.check_in  >= filtroDal     ? p.check_in  : filtroDal;
    const co = p.check_out <= fineEsclusiva ? p.check_out : fineEsclusiva;
    return Math.max(0, differenceInDays(parseISO(co), parseISO(ci)));
  }

  const statsCamera = camere.map((camera) => {
    const pren = prenNelPeriodo.filter((p) => p.camera_id === camera.id);
    const notti = pren.reduce((s, p) => s + nottiInPeriodo(p), 0);
    const ricavo = pren.filter((p) => p.importo_totale > 0).reduce((s, p) => s + p.importo_totale, 0);
    return { camera, notti, ricavo };
  });
  const maxNotti = Math.max(1, ...statsCamera.map((s) => s.notti));

  // ── Prima Nota ──────────────────────────────────────────────
  const uscitePeriodo = uscite.filter(u => u.data >= filtroDal && u.data <= filtroAl);
  const entratePeriodo = entrate.filter(e => e.data >= filtroDal && e.data <= filtroAl);

  const uscitePerCat = (CATEGORIE_USCITA as readonly string[])
    .map(cat => ({
      categoria: cat,
      totale: uscitePeriodo.filter(u => u.categoria === cat).reduce((s, u) => s + u.importo, 0),
    }))
    .filter(c => c.totale > 0)
    .sort((a, b) => b.totale - a.totale);

  const entratePerCat = (CATEGORIE_ENTRATA as readonly string[])
    .map(cat => ({
      categoria: cat,
      totale: entratePeriodo.filter(e => e.categoria === cat).reduce((s, e) => s + e.importo, 0),
    }))
    .filter(c => c.totale > 0)
    .sort((a, b) => b.totale - a.totale);

  const maxUscitaCat  = Math.max(1, ...uscitePerCat.map(c => c.totale));
  const maxEntrataCat = Math.max(1, ...entratePerCat.map(c => c.totale));
  const saldo = entrateEffettive - usciteDelPeriodo;
  const incidenzaUscite = entrateEffettive > 0 ? (usciteDelPeriodo / entrateEffettive) * 100 : 0;

  const movimenti = [
    ...entratePeriodo.map(e => ({ tipo: 'entrata' as const, data: e.data, descrizione: e.descrizione, categoria: e.categoria, importo: e.importo, id: e.id })),
    ...uscitePeriodo.map(u => ({ tipo: 'uscita' as const, data: u.data, descrizione: u.descrizione, categoria: u.categoria, importo: u.importo, id: u.id })),
  ].sort((a, b) => b.data.localeCompare(a.data));

  function buildChartData(cameraId: number) {
    const start = parseISO(filtroDal);
    const nDays = differenceInDays(parseISO(filtroAl), start) + 1;
    return Array.from({ length: nDays }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dayStr = format(d, 'yyyy-MM-dd');
      const booking = prenotazioni.find(p =>
        p.camera_id === cameraId && p.stato === 'confermata' &&
        p.check_in <= dayStr && p.check_out > dayStr
      );
      const notti = booking ? differenceInDays(parseISO(booking.check_out), parseISO(booking.check_in)) : 0;
      const valore = booking && booking.importo_totale > 0 && notti > 0
        ? Math.round(booking.importo_totale / notti) : 0;
      const isCheckIn = prenotazioni.some(p =>
        p.camera_id === cameraId && p.stato === 'confermata' && p.check_in === dayStr
      );
      return { giorno: parseInt(dayStr.slice(8)), valore, saturazione: booking ? 100 : 0, arrivo: isCheckIn ? 1 : 0 };
    });
  }

  function scaricaExcelCamere() {
    const nGiorniPeriodo = differenceInDays(parseISO(filtroAl), parseISO(filtroDal)) + 1;
    const intestazioni = ['Camera', 'Notti Occupate', `Giorni Periodo`, 'Saturazione %', 'N° Prenotazioni', 'Ricavo Totale (€)', 'Prezzo Medio/Notte (€)', 'Prezzo Base (€)'];
    const righe = camere
      .filter(c => filtroCamera === 'tutte' || c.id === filtroCamera)
      .sort((a, b) => a.id - b.id)
      .map(camera => {
        const { notti, ricavo } = statsCamera.find(s => s.camera.id === camera.id) ?? { notti: 0, ricavo: 0 };
        const pren = prenNelPeriodo.filter(p => p.camera_id === camera.id);
        const satPct = nGiorniPeriodo > 0 ? ((notti / nGiorniPeriodo) * 100).toFixed(1) : '0.0';
        const mediaNotteRicavo = notti > 0 && ricavo > 0 ? (ricavo / notti).toFixed(2) : '';
        return [camera.nome, notti, nGiorniPeriodo, satPct, pren.length, ricavo > 0 ? ricavo.toFixed(2) : '', mediaNotteRicavo, camera.prezzo_notte.toFixed(2)];
      });
    // Aggiunge prenotazioni dettagliate
    const intestazioniPren = ['', '', '', '', '', '', '', ''];
    const intestazioniPren2 = ['Camera', 'Ospite', 'Check-in', 'Check-out', 'Notti', 'Importo (€)', 'Fonte', ''];
    const righePren = prenNelPeriodo
      .sort((a, b) => a.check_in.localeCompare(b.check_in))
      .map(p => {
        const cam = camere.find(c => c.id === p.camera_id);
        const notti = differenceInDays(parseISO(p.check_out), parseISO(p.check_in));
        return [cam?.nome ?? `Camera ${p.camera_id}`, p.ospite_nome, p.check_in, p.check_out, notti, p.importo_totale > 0 ? p.importo_totale.toFixed(2) : '', p.fonte, ''];
      });
    const csv = [intestazioni, ...righe, intestazioniPren, intestazioniPren2, ...righePren]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `camere_${filtroDal}_${filtroAl}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  function scaricaExcelPrimaNota() {
    const intestazioni = ['Data', 'Tipo', 'Descrizione', 'Categoria', 'Importo (€)'];
    const righe = movimenti.map(m => [
      m.data,
      m.tipo === 'entrata' ? 'Entrata' : 'Uscita',
      m.descrizione,
      m.categoria,
      (m.tipo === 'entrata' ? '+' : '-') + m.importo.toFixed(2),
    ]);
    righe.push(['', '', 'Totale entrate', '', '+' + entrateEffettive.toFixed(2)]);
    righe.push(['', '', 'Totale uscite', '', '-' + usciteDelPeriodo.toFixed(2)]);
    righe.push(['', '', 'Saldo netto', '', (saldo >= 0 ? '+' : '') + saldo.toFixed(2)]);
    const csv = [intestazioni, ...righe]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `prima-nota-dashboard_${filtroDal}_${filtroAl}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Caricamento...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <div className="flex items-center gap-2 no-print">
          {syncMsg && (
            <span className={`hidden sm:inline text-xs px-2 py-1 rounded ${
              syncOk === false ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
            }`}>{syncMsg}</span>
          )}
          <button
            onClick={() => sezione === 'camere' ? scaricaExcelCamere() : scaricaExcelPrimaNota()}
            title="Esporta Excel"
            className="flex items-center gap-1.5 border border-gray-300 bg-white text-gray-700 px-2.5 py-1.5 rounded text-sm font-medium hover:bg-gray-50"
          >
            <FileSpreadsheet size={14} className="text-green-600" />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button onClick={() => window.print()} title="Stampa / Salva PDF"
            className="flex items-center gap-1.5 border border-gray-300 bg-white text-gray-700 px-2.5 py-1.5 rounded text-sm font-medium hover:bg-gray-50"
          >
            <Printer size={14} className="text-gray-500" />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button
            onClick={syncIcal}
            disabled={syncing}
            className={`flex items-center gap-1.5 border px-2.5 py-1.5 rounded text-sm font-medium transition-colors ${
              syncOk === true  ? 'border-green-300 bg-green-50 text-green-700' :
              syncOk === false ? 'border-red-300 bg-red-50 text-red-700' :
              'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Sync iCal</span>
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setSezione('camere')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            sezione === 'camere' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart2 size={14} />
          Performance Camere
        </button>
        <button
          onClick={() => setSezione('prima_nota')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            sezione === 'prima_nota' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BookOpen size={14} />
          Analisi Prima Nota
        </button>
      </div>

      {/* KPI mobile compatto */}
      <div className="sm:hidden bg-white rounded-lg shadow-sm px-4 py-3 grid grid-cols-3 gap-y-3 divide-x divide-gray-100">
        <div className="text-center">
          <div className="text-[11px] text-gray-400">Camere</div>
          <div className="text-base font-bold text-gray-800">{camereImpegnate.length}/{filtroCamera === 'tutte' ? camere.length : 1}</div>
        </div>
        <div className="text-center">
          <div className="text-[11px] text-gray-400">Previsionali</div>
          <div className="text-base font-bold text-gray-800">€{entrateDelPeriodo.toFixed(0)}</div>
        </div>
        <div className="text-center">
          <div className="text-[11px] text-gray-400">Ospiti</div>
          <div className="text-base font-bold text-gray-800">{totalOspiti}</div>
        </div>
        <div className="text-center pt-2">
          <div className="text-[11px] text-gray-400">Uscite</div>
          <div className="text-base font-bold text-red-600">-€{usciteDelPeriodo.toFixed(0)}</div>
        </div>
        <div className="text-center pt-2">
          <div className="text-[11px] text-gray-400">Entrate</div>
          <div className="text-base font-bold text-green-700">+€{entrateEffettive.toFixed(0)}</div>
        </div>
        <div className="text-center pt-2">
          <div className="text-[11px] text-gray-400">Saldo</div>
          <div className={`text-base font-bold ${saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>€{saldo.toFixed(0)}</div>
        </div>
      </div>

      {/* KPI cards desktop */}
      <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-3">
          <div className="bg-blue-100 rounded-full p-2"><BedDouble size={20} className="text-blue-600" /></div>
          <div>
            <div className="text-sm text-gray-500">Camere nel periodo</div>
            <div className="text-lg font-bold text-gray-800">{camereImpegnate.length} / {filtroCamera === 'tutte' ? camere.length : 1}</div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-3">
          <div className="bg-green-100 rounded-full p-2"><Euro size={20} className="text-green-600" /></div>
          <div>
            <div className="text-sm text-gray-500">Prenotazioni (prev.)</div>
            <div className="text-lg font-bold text-gray-800">€{entrateDelPeriodo.toFixed(2)}</div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-3">
          <div className="bg-purple-100 rounded-full p-2"><Users size={20} className="text-purple-600" /></div>
          <div>
            <div className="text-sm text-gray-500">Ospiti nel periodo</div>
            <div className="text-lg font-bold text-gray-800">{totalOspiti}</div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-3">
          <div className="bg-red-100 rounded-full p-2"><TrendingDown size={20} className="text-red-600" /></div>
          <div>
            <div className="text-sm text-gray-500">Uscite del periodo</div>
            <div className="text-lg font-bold text-red-600">-€{usciteDelPeriodo.toFixed(2)}</div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-3">
          <div className="bg-green-100 rounded-full p-2"><TrendingUp size={20} className="text-green-600" /></div>
          <div>
            <div className="text-sm text-gray-500">Entrate effettive</div>
            <div className="text-lg font-bold text-green-700">+€{entrateEffettive.toFixed(2)}</div>
          </div>
        </div>
        <div className={`rounded-lg shadow-sm p-4 flex items-center gap-3 ${saldo >= 0 ? 'bg-white' : 'bg-red-50'}`}>
          <div className={`rounded-full p-2 ${saldo >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
            <TrendingUp size={20} className={saldo >= 0 ? 'text-green-600' : 'text-red-600'} />
          </div>
          <div>
            <div className="text-sm text-gray-500">Saldo effettivo</div>
            <div className={`text-lg font-bold ${saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>€{saldo.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Filtro periodo + camera */}
      <div className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-4 flex-wrap">
        <span className="text-sm font-medium text-gray-600">Periodo:</span>
        <div className="flex items-center gap-1">
          <button onClick={() => spostaMese(-1)} className="p-1 rounded hover:bg-gray-100"><ChevronLeft size={16} /></button>
          <input type="date" value={filtroDal} onChange={(e) => setFiltroDal(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <span className="text-gray-400 text-sm">→</span>
          <input type="date" value={filtroAl} onChange={(e) => setFiltroAl(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <button onClick={() => spostaMese(1)} className="p-1 rounded hover:bg-gray-100"><ChevronRight size={16} /></button>
        </div>
        <div className="w-px h-5 bg-gray-200" />
        <span className="text-sm font-medium text-gray-600">Camera:</span>
        <select
          value={filtroCamera}
          onChange={(e) => setFiltroCamera(e.target.value === 'tutte' ? 'tutte' : Number(e.target.value))}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="tutte">Tutte</option>
          {camere.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        {filtroAttivo && (
          <button
            onClick={() => { setFiltroDal(DEFAULT_DAL); setFiltroAl(DEFAULT_AL); setFiltroCamera('tutte'); }}
            className="text-sm text-blue-600 hover:underline"
          >Reset</button>
        )}
      </div>

      {/* ═══════════════════════ SEZIONE: PERFORMANCE CAMERE ═══════════════════════ */}
      {sezione === 'camere' && (
        <div className="space-y-4">

          {/* Statistiche per stanza — mobile */}
          <div className="sm:hidden bg-white rounded-lg shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Statistiche per stanza</h2>
            {(() => {
              const nGiorniPeriodo = differenceInDays(parseISO(filtroAl), parseISO(filtroDal)) + 1;
              const camFiltrate = camere.filter(c => filtroCamera === 'tutte' || c.id === filtroCamera).sort((a, b) => a.id - b.id);
              return camFiltrate.map(camera => {
                const pren = prenNelPeriodo.filter(p => p.camera_id === camera.id);
                const notti = pren.reduce((s, p) => s + nottiInPeriodo(p), 0);
                const ricavo = pren.filter(p => p.importo_totale > 0).reduce((s, p) => s + p.importo_totale, 0);
                const satPct = nGiorniPeriodo > 0 ? Math.round((notti / nGiorniPeriodo) * 100) : 0;
                const col = getCameraStyle(camera.id, camera.colore);
                return (
                  <div key={camera.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold w-20 ${col.testo}`}>{camera.nome}</span>
                        <span className="text-[11px] text-gray-400">{notti}n / {nGiorniPeriodo}gg</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {ricavo > 0 && <span className="text-xs font-semibold text-gray-800">€{ricavo.toFixed(0)}</span>}
                        <span className={`text-[11px] font-bold w-9 text-right ${satPct >= 70 ? 'text-green-600' : satPct >= 30 ? 'text-amber-500' : 'text-gray-400'}`}>{satPct}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${col.bar}`} style={{ width: `${satPct}%` }} />
                    </div>
                  </div>
                );
              });
            })()}
            <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
              <span className="text-xs text-gray-400">Totale ricavi periodo</span>
              <span className="text-sm font-bold text-gray-800">€{entrateDelPeriodo.toFixed(0)}</span>
            </div>
          </div>

          {/* Stato camere nel periodo */}
          {(() => {
            const camFiltrate = camere.filter((c) => filtroCamera === 'tutte' || c.id === filtroCamera).sort((a, b) => a.id - b.id);
            return (
              <div className="bg-white rounded-lg shadow-sm p-3 sm:p-5">
                <h2 className="font-semibold text-gray-700 mb-3 sm:mb-4 text-sm sm:text-base">Camere nel periodo</h2>
                <div className={`grid gap-1.5 sm:gap-3 ${camFiltrate.length === 1 ? 'grid-cols-1' : 'grid-cols-5'}`}>
                  {camFiltrate.map((camera) => {
                    const prenotazioniCamera = prenNelPeriodo.filter((p) => p.camera_id === camera.id);
                    const impegnata = prenotazioniCamera.length > 0;
                    const nottiTotali = prenotazioniCamera.reduce((s, p) => s + differenceInDays(parseISO(p.check_out), parseISO(p.check_in)), 0);
                    const stimaCamera = prenotazioniCamera.filter((p) => p.importo_totale > 0).reduce((s, p) => s + p.importo_totale, 0);
                    const occupazioneOggi = isCameraOccupata(prenotazioni, camera.id);
                    const col = getCameraStyle(camera.id, camera.colore);
                    return (
                      <div key={camera.id} className={`rounded-lg p-1.5 sm:p-3 text-center border ${col.bg} ${col.border}`}>
                        <div className={`font-bold text-[10px] sm:text-sm ${col.testo}`}>{camera.nome}</div>
                        <div className={`text-[9px] sm:text-xs font-medium mt-0.5 ${impegnata ? 'text-red-700' : 'text-green-700'}`}>
                          {impegnata ? `${prenotazioniCamera.length} pren.` : 'Libera'}
                        </div>
                        {impegnata && <div className="text-[9px] sm:text-xs text-gray-500 mt-0.5">{nottiTotali}n</div>}
                        {stimaCamera > 0 && <div className="text-[9px] sm:text-xs font-semibold text-green-700 mt-0.5">€{stimaCamera.toFixed(0)}</div>}
                        {stimaCamera > 0 && nottiTotali > 0 && <div className="text-[9px] sm:text-xs text-gray-500 mt-0.5">€{Math.round(stimaCamera / nottiTotali)}/notte</div>}
                        {occupazioneOggi && (
                          <div className={`text-[9px] sm:text-xs mt-0.5 truncate font-medium ${col.testo}`}>
                            {occupazioneOggi.ospite_nome.split(' ')[0]}
                          </div>
                        )}
                        <div className="text-[9px] sm:text-xs text-gray-400 mt-0.5">€{camera.prezzo_notte.toFixed(0)}/n</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Andamento prenotazioni per stanza — desktop */}
          {(() => {
            const start  = new Date(filtroDal + 'T00:00:00Z');
            const nDays  = differenceInDays(new Date(filtroAl + 'T00:00:00Z'), start) + 1;
            const days   = Array.from({ length: nDays }, (_, i) => {
              const d = new Date(start);
              d.setUTCDate(d.getUTCDate() + i);
              return d.toISOString().split('T')[0];
            });
            const camFiltrate = camere.filter(c => filtroCamera === 'tutte' || c.id === filtroCamera).sort((a, b) => a.id - b.id);
            const getPren = (cameraId: number, day: string) =>
              prenotazioni.find(p => p.camera_id === cameraId && p.stato !== 'cancellata' && p.check_in <= day && p.check_out > day) ?? null;
            return (
              <div className="hidden md:block bg-white rounded-lg shadow-sm p-5">
                <h2 className="font-semibold text-gray-700 mb-3">Andamento prenotazioni per stanza</h2>
                <div className="overflow-x-auto">
                  <div style={{ minWidth: 'max-content' }}>
                    <div className="flex mb-1" style={{ paddingLeft: '92px' }}>
                      {days.map(day => {
                        const dow = new Date(day + 'T00:00:00Z').getUTCDay();
                        const isWe = dow === 0 || dow === 6;
                        return (
                          <div key={day} className={`text-center text-[10px] leading-none select-none ${isWe ? 'text-blue-500 font-semibold' : 'text-gray-400'}`} style={{ width: '26px' }}>
                            {parseInt(day.slice(8))}
                          </div>
                        );
                      })}
                    </div>
                    {camFiltrate.map(camera => {
                      const col = getCameraStyle(camera.id, camera.colore);
                      return (
                        <div key={camera.id} className="flex items-center mb-1">
                          <div className={`text-xs font-semibold flex-shrink-0 ${col.testo}`} style={{ width: '92px' }}>{camera.nome}</div>
                          <div className="flex gap-px">
                            {days.map((day, idx) => {
                              const pren     = getPren(camera.id, day);
                              const prevPren = idx > 0 ? getPren(camera.id, days[idx - 1]) : null;
                              const isStart  = pren && (!prevPren || prevPren.id !== pren.id);
                              const isEnd    = pren && (idx === days.length - 1 || !getPren(camera.id, days[idx + 1]));
                              return (
                                <div
                                  key={day}
                                  title={pren ? `${pren.ospite_nome}  ${pren.check_in} → ${pren.check_out}` : ''}
                                  className={`relative flex items-center overflow-hidden ${
                                    pren
                                      ? `${col.bar} ${isStart && isEnd ? 'rounded' : isStart ? 'rounded-l' : isEnd ? 'rounded-r' : ''}`
                                      : 'bg-gray-100 rounded-sm'
                                  }`}
                                  style={{ width: '26px', height: '22px' }}
                                >
                                  {isStart && (
                                    <span className="text-white text-[8px] font-bold pl-1 truncate leading-none select-none">
                                      {pren!.ospite_nome.split(' ')[0]}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Grafici statistici per stanza — desktop */}
          <div className="hidden md:block space-y-3">
            <h2 className="font-semibold text-gray-700">Statistiche giornaliere per stanza</h2>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              {camere
                .filter(c => filtroCamera === 'tutte' || c.id === filtroCamera)
                .sort((a, b) => a.id - b.id)
                .map(camera => {
                  const col = getCameraStyle(camera.id, camera.colore);
                  const data = buildChartData(camera.id);
                  const giorniOccupati = data.filter(d => d.saturazione > 0).length;
                  const totValore = data.reduce((s, d) => s + d.valore, 0);
                  const satPercent = data.length > 0 ? Math.round((giorniOccupati / data.length) * 100) : 0;
                  return (
                    <div key={camera.id} className="bg-white rounded-lg shadow-sm p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-bold ${col.testo}`}>{camera.nome}</span>
                        <span className="text-xs text-gray-400">{format(parseISO(filtroDal), 'MMM yyyy')}</span>
                      </div>
                      <div className="flex gap-4 mb-3 text-xs">
                        <span className="text-gray-500">Saturazione: <span className="font-semibold text-gray-800">{satPercent}%</span></span>
                        <span className="text-gray-500">Occupati: <span className="font-semibold text-gray-800">{giorniOccupati}gg</span></span>
                        <span className="text-gray-500">Ricavo: <span className="font-semibold text-gray-800">€{totValore}</span></span>
                      </div>
                      <ResponsiveContainer width="100%" height={170}>
                        <ComposedChart data={data} margin={{ top: 4, right: 30, left: -10, bottom: 0 }} barCategoryGap="20%">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                          <XAxis dataKey="giorno" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={Math.floor(data.length / 8)} />
                          <YAxis yAxisId="val" orientation="left" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={v => v > 0 ? `€${v}` : ''} width={38} />
                          <YAxis yAxisId="sat" orientation="right" domain={[0, 100]} tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} ticks={[0, 50, 100]} width={32} />
                          <Tooltip
                            contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                            formatter={(value, name) => {
                              const v = Number(value);
                              if (name === 'Valore €/notte') return [`€${v}`, name];
                              if (name === 'Saturazione') return [`${v}%`, name];
                              if (name === 'Arrivo ospite') return [v === 1 ? 'Sì' : 'No', name];
                              return [value, name];
                            }}
                            labelFormatter={(v) => `Giorno ${v}`}
                          />
                          <Legend iconSize={8} wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                          <Area yAxisId="sat" type="step" dataKey="saturazione" name="Saturazione" stroke={col.hex} fill={col.hexLight} strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} opacity={0.6} />
                          <Bar yAxisId="val" dataKey="valore" name="Valore €/notte" fill={col.hexArea} radius={[2, 2, 0, 0]} maxBarSize={18} />
                          <Line
                            yAxisId="sat" dataKey="arrivo" name="Arrivo ospite" stroke="#f59e0b" strokeWidth={0}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            dot={(props: any) =>
                              props?.payload?.arrivo === 1
                                ? <circle key={`dot-${props.cx}`} cx={props.cx ?? 0} cy={props.cy ?? 0} r={4} fill="#f59e0b" stroke="#fff" strokeWidth={1} />
                                : <g key={`dot-${props.cx}`} />
                            }
                            activeDot={false} legendType="circle"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Saturazione globale stanze — desktop */}
          <div className="hidden md:block bg-white rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-700">Saturazione per stanza</h2>
              <span className="text-xs text-gray-400">
                {differenceInDays(parseISO(filtroAl), parseISO(filtroDal)) + 1} giorni nel periodo
              </span>
            </div>
            <div className="space-y-3">
              {camere
                .filter(c => filtroCamera === 'tutte' || c.id === filtroCamera)
                .sort((a, b) => a.id - b.id)
                .map(camera => {
                  const { notti, ricavo } = statsCamera.find(s => s.camera.id === camera.id) ?? { notti: 0, ricavo: 0 };
                  const nGiorniPeriodo = differenceInDays(parseISO(filtroAl), parseISO(filtroDal)) + 1;
                  const satPct = nGiorniPeriodo > 0 ? Math.round((notti / nGiorniPeriodo) * 100) : 0;
                  const col = getCameraStyle(camera.id, camera.colore);
                  return (
                    <div key={camera.id} className="flex items-center gap-4">
                      <span className={`text-xs font-semibold w-24 flex-shrink-0 ${col.testo}`}>{camera.nome}</span>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${col.bar}`}
                          style={{ width: `${(notti / maxNotti) * 100}%` }}
                          title={`${notti} notti`}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-16 text-right">{notti}n &nbsp; {satPct}%</span>
                      {ricavo > 0 && (
                        <span className="text-xs font-semibold text-gray-700 w-16 text-right">€{ricavo.toFixed(0)}</span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

        </div>
      )}

      {/* ═══════════════════════ SEZIONE: PRIMA NOTA ═══════════════════════ */}
      {sezione === 'prima_nota' && (
        <div className="space-y-4">

          {/* Riepilogo saldo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Entrate effettive</div>
              <div className="text-xl font-bold text-green-700">+€{entrateEffettive.toFixed(2)}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{entratePeriodo.length} movimenti</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Uscite totali</div>
              <div className="text-xl font-bold text-red-600">-€{usciteDelPeriodo.toFixed(2)}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{uscitePeriodo.length} movimenti</div>
            </div>
            <div className={`border rounded-lg p-4 ${saldo >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="text-xs text-gray-500 mb-1">Saldo netto</div>
              <div className={`text-xl font-bold ${saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>€{saldo.toFixed(2)}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{saldo >= 0 ? 'Positivo' : 'Negativo'}</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Incidenza uscite</div>
              <div className="text-xl font-bold text-amber-700">{incidenzaUscite.toFixed(1)}%</div>
              <div className="text-[10px] text-gray-400 mt-0.5">delle entrate</div>
            </div>
          </div>

          {/* Entrate per fonte + Uscite per categoria */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Entrate per fonte */}
            <div className="bg-white rounded-lg shadow-sm p-5">
              <h3 className="font-semibold text-gray-700 mb-4 text-sm flex items-center gap-2">
                <TrendingUp size={15} className="text-green-600" />
                Entrate per fonte
              </h3>
              {entratePerCat.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nessuna entrata nel periodo</p>
              ) : (
                <div className="space-y-3">
                  {entratePerCat.map(({ categoria, totale }) => {
                    const pct = entrateEffettive > 0 ? (totale / entrateEffettive) * 100 : 0;
                    const col = COLORI_CAT_ENTRATA[categoria] ?? COLORI_CAT_ENTRATA['Altro'];
                    return (
                      <div key={categoria}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-700">{categoria}</span>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="font-semibold text-gray-800">€{totale.toFixed(2)}</span>
                            <span className="text-gray-400 w-10 text-right">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${col.bar}`} style={{ width: `${(totale / maxEntrataCat) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="border-t pt-2 flex justify-between text-xs text-gray-500">
                    <span>Totale</span>
                    <span className="font-bold text-green-700">+€{entrateEffettive.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Uscite per categoria */}
            <div className="bg-white rounded-lg shadow-sm p-5">
              <h3 className="font-semibold text-gray-700 mb-4 text-sm flex items-center gap-2">
                <TrendingDown size={15} className="text-red-600" />
                Uscite per categoria
              </h3>
              {uscitePerCat.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nessuna uscita nel periodo</p>
              ) : (
                <div className="space-y-3">
                  {uscitePerCat.map(({ categoria, totale }) => {
                    const pctUscite = usciteDelPeriodo > 0 ? (totale / usciteDelPeriodo) * 100 : 0;
                    const pctEntrate = entrateEffettive > 0 ? (totale / entrateEffettive) * 100 : 0;
                    const col = COLORI_CAT_USCITA[categoria] ?? COLORI_CAT_USCITA['Altro'];
                    return (
                      <div key={categoria}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-700">{categoria}</span>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-gray-800">€{totale.toFixed(2)}</span>
                            <span className="text-gray-400 w-9 text-right">{pctUscite.toFixed(0)}%</span>
                            {entrateEffettive > 0 && (
                              <span className="text-amber-600 w-16 text-right text-[10px] tabular-nums">
                                {pctEntrate.toFixed(1)}% su ent.
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${col.bar}`} style={{ width: `${(totale / maxUscitaCat) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="border-t pt-2 flex justify-between text-xs text-gray-500">
                    <span>Totale</span>
                    <span className="font-bold text-red-600">-€{usciteDelPeriodo.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Movimenti del periodo */}
          <div className="bg-white rounded-lg shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 mb-4 text-sm flex items-center gap-2">
              <BookOpen size={15} className="text-gray-600" />
              Movimenti del periodo
              <span className="ml-auto text-xs font-normal text-gray-400">{movimenti.length} voci</span>
            </h3>
            {movimenti.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Nessun movimento nel periodo</p>
            ) : (
              <table className="w-full text-xs table-fixed">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-2 font-medium text-gray-400 uppercase tracking-wide text-[10px] w-20">Data</th>
                    <th className="text-left py-2 pr-2 font-medium text-gray-400 uppercase tracking-wide text-[10px] hidden sm:table-cell w-20">Tipo</th>
                    <th className="text-left py-2 pr-2 font-medium text-gray-400 uppercase tracking-wide text-[10px] w-auto">Descrizione</th>
                    <th className="text-left py-2 pr-2 font-medium text-gray-400 uppercase tracking-wide text-[10px] hidden sm:table-cell w-28">Categoria</th>
                    <th className="text-right py-2 pr-1 font-medium text-gray-400 uppercase tracking-wide text-[10px] w-24">Importo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimenti.map((m) => {
                    const colCat = m.tipo === 'entrata'
                      ? (COLORI_CAT_ENTRATA[m.categoria] ?? COLORI_CAT_ENTRATA['Altro'])
                      : (COLORI_CAT_USCITA[m.categoria] ?? COLORI_CAT_USCITA['Altro']);
                    return (
                      <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-2 pr-2 text-gray-500 whitespace-nowrap">{fData(m.data)}</td>
                        <td className="py-2 pr-2 hidden sm:table-cell">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            m.tipo === 'entrata' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {m.tipo === 'entrata' ? '+' : '−'} {m.tipo === 'entrata' ? 'Entrata' : 'Uscita'}
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-gray-700 max-w-0 w-auto"><div className="truncate">{m.descrizione || '—'}</div></td>
                        <td className="py-2 pr-2 hidden sm:table-cell">
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colCat.bar}`} />
                            {m.categoria}
                          </span>
                        </td>
                        <td className={`py-2 pl-2 text-right font-semibold tabular-nums whitespace-nowrap ${
                          m.tipo === 'entrata' ? 'text-green-700' : 'text-red-600'
                        }`}>
                          {m.tipo === 'entrata' ? '+' : '−'}€{m.importo.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={4} className="py-2 pr-2 text-xs font-semibold text-gray-600">Saldo periodo</td>
                    <td className={`py-2 pl-2 text-right font-bold text-sm tabular-nums whitespace-nowrap ${saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {saldo >= 0 ? '+' : '−'}€{Math.abs(saldo).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
