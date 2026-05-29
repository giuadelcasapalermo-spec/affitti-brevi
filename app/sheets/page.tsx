'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Table2, Settings, RefreshCw, ArrowUpFromLine } from 'lucide-react';
import Link from 'next/link';

export default function SheetsPage() {
  const [sheetId, setSheetId] = useState<string | null>(null);
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
        setSheetId(data.google_sheet_id ?? null);
        setAbilitato(data.google_sheets_abilitato ?? false);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Caricamento...</div>;
  }

  if (!abilitato || !sheetId) {
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

  const editUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;

  return (
    <div className="flex flex-col pb-24 md:pb-0" style={{ height: 'calc(100dvh - 80px)' }}>
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Table2 size={20} className="text-emerald-600" />
          Google Sheets
        </h1>
        <div className="flex items-center gap-2">
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

      <iframe
        src={editUrl}
        className="flex-1 w-full rounded-lg border border-gray-200 shadow-sm bg-white"
        title="Google Sheets"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
