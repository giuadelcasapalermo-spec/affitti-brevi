'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Table2, Settings, RefreshCw, ArrowUpFromLine, CalendarRange, X } from 'lucide-react';
import Link from 'next/link';
import FogliAnnuali from '@/components/FogliAnnuali';

/** Foglio selezionabile: un anno con il suo foglio, oppure il foglio principale */
type Scelta = number | 'principale';
const CHIAVE_SCELTA = 'sheets-anno';

export default function SheetsPage() {
  const [principale, setPrincipale] = useState<string | null>(null);
  const [anni, setAnni] = useState<Record<number, string>>({});
  const [scelta, setScelta] = useState<Scelta | null>(null);
  const [gestione, setGestione] = useState(false);
  const [abilitato, setAbilitato] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; testo: string } | null>(null);

  async function exportToSheets() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direzione: 'export' }),
      });
      const json = await res.json();
      setSyncMsg({ ok: json.ok, testo: json.messaggio ?? json.errore ?? 'Errore' });
    } catch {
      setSyncMsg({ ok: false, testo: 'Errore di rete' });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  }

  useEffect(() => {
    fetch('/api/impostazioni')
      .then(r => r.json())
      .then(data => {
        setPrincipale(data.google_sheet_id?.trim() || null);
        setAnni(data.google_sheets_anni ?? {});
        setAbilitato(data.google_sheets_abilitato ?? false);
        setLoading(false);
      });
  }, []);

  const elencoAnni = Object.keys(anni).map(Number).sort((a, b) => a - b);

  // Scelta valida: quella ricordata, altrimenti l'anno in corso, l'ultimo anno o il principale
  const ricordata = (() => {
    try { return localStorage.getItem(CHIAVE_SCELTA); } catch { return null; }
  })();
  const valida = (s: Scelta | null): s is Scelta =>
    s !== null && (s === 'principale' ? !!principale : !!anni[s]);
  const iniziale: Scelta | null = [
    ricordata === 'principale' ? 'principale' as const : ricordata ? Number(ricordata) : null,
    new Date().getFullYear(),
    elencoAnni[elencoAnni.length - 1] ?? null,
    'principale' as const,
  ].find(valida) ?? null;
  const attiva = valida(scelta) ? scelta : iniziale;

  function scegli(s: Scelta) {
    setScelta(s);
    try { localStorage.setItem(CHIAVE_SCELTA, String(s)); } catch { /* storage non disponibile */ }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Caricamento...</div>;
  }

  if (!abilitato || attiva === null) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <Table2 size={40} className="text-gray-300" />
        <p className="text-gray-500 text-sm">
          {!abilitato
            ? "L'integrazione Google Sheets non è attiva."
            : 'Nessun foglio Google configurato.'}
        </p>
        <Link
          href="/impostazioni"
          className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-emerald-700"
        >
          <Settings size={14} />
          Vai alle impostazioni
        </Link>
      </div>
    );
  }

  const sheetId = attiva === 'principale' ? principale! : anni[attiva];
  const editUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
  // Il principale si mostra solo se è un foglio a sé (non già uno dei fogli annuali)
  const mostraPrincipale = !!principale && !Object.values(anni).includes(principale);
  const pill = (attivo: boolean) =>
    `px-3 py-1 rounded-full text-sm font-medium border transition-colors ${attivo
      ? 'bg-emerald-600 border-emerald-600 text-white'
      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`;

  return (
    <div className="flex flex-col pb-24 md:pb-0" style={{ height: 'calc(100dvh - 80px)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Table2 size={20} className="text-emerald-600" />
          Google Sheets
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportToSheets}
            disabled={syncing}
            className="flex items-center gap-1.5 border border-gray-300 bg-white text-gray-700 px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {syncing ? <RefreshCw size={14} className="animate-spin" /> : <ArrowUpFromLine size={14} />}
            Allinea uscite in sheet
          </button>
          {syncMsg && (
            <span className={`text-xs px-2 py-1 rounded ${syncMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {syncMsg.testo}
            </span>
          )}
          <a
            href={editUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 border border-emerald-300 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded text-sm font-medium hover:bg-emerald-100"
          >
            <ExternalLink size={14} />
            Apri in Google
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-2 flex-shrink-0">
        {elencoAnni.map(a => (
          <button key={a} onClick={() => scegli(a)} className={pill(attiva === a)}>{a}</button>
        ))}
        {mostraPrincipale && (
          <button onClick={() => scegli('principale')} className={pill(attiva === 'principale')}
            title="Prima Nota App, Impostazioni e gli anni senza un foglio proprio">
            Principale
          </button>
        )}
        <button onClick={() => setGestione(g => !g)}
          className="flex items-center gap-1 px-3 py-1 rounded-full text-sm text-gray-500 hover:text-emerald-700">
          {gestione ? <X size={14} /> : <CalendarRange size={14} />}
          {gestione ? 'Chiudi' : 'Gestisci anni'}
        </button>
      </div>

      {gestione && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 mb-2 flex-shrink-0">
          <FogliAnnuali key={JSON.stringify(anni)} anni={anni} onSalvato={nuovi => { setAnni(nuovi); setGestione(false); }} />
        </div>
      )}

      <iframe
        key={sheetId}
        src={editUrl}
        className="flex-1 w-full rounded-lg border border-gray-200 shadow-sm bg-white"
        title={`Google Sheets ${attiva === 'principale' ? 'principale' : attiva}`}
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
