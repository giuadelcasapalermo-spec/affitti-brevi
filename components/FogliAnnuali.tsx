'use client';

import { useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';

/** ID del foglio da un URL di Google Sheets o dall'ID incollato così com'è */
function idFoglio(raw: string): string {
  const s = raw.trim();
  return s.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? s;
}

/** Un foglio Google per anno: i tab mensili di quell'anno si leggono e scrivono lì */
export default function FogliAnnuali({ anni, onSalvato }: {
  anni: Record<number, string>;
  onSalvato: (anni: Record<number, string>) => void;
}) {
  const [righe, setRighe] = useState<{ anno: string; id: string }[]>(() =>
    Object.entries(anni).sort(([a], [b]) => Number(a) - Number(b)).map(([anno, id]) => ({ anno, id })));
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');

  const aggiorna = (i: number, campo: 'anno' | 'id', v: string) =>
    setRighe(r => r.map((x, j) => j === i ? { ...x, [campo]: v } : x));

  function aggiungi() {
    const ultimo = Math.max(new Date().getFullYear() - 1, ...righe.map(r => Number(r.anno) || 0));
    setRighe(r => [...r, { anno: String(ultimo + 1), id: '' }]);
  }

  async function salva() {
    const nuovi: Record<number, string> = {};
    for (const r of righe) {
      const anno = Number(r.anno);
      const id = idFoglio(r.id);
      if (!id) continue;
      if (!Number.isInteger(anno) || anno < 2000 || anno > 2100) { setMsg(`Anno non valido: ${r.anno}`); return; }
      if (nuovi[anno]) { setMsg(`Anno ${anno} indicato due volte`); return; }
      nuovi[anno] = id;
    }
    setSalvando(true);
    setMsg('');
    try {
      const res = await fetch('/api/impostazioni', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ google_sheets_anni: nuovi }),
      });
      if (!res.ok) throw new Error();
      setRighe(Object.entries(nuovi).map(([anno, id]) => ({ anno, id })));
      onSalvato(nuovi);
      setMsg('Salvato');
    } catch {
      setMsg('Errore nel salvataggio');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mb-3">
      <div className="text-xs font-medium text-gray-600 mb-1">Fogli per anno</div>
      <p className="text-xs text-gray-400 mb-2">
        I tab mensili di ogni anno si leggono e scrivono nel suo foglio. Gli anni senza foglio restano nel foglio principale qui sopra.
      </p>
      <div className="space-y-1.5">
        {righe.map((r, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input type="number" value={r.anno} onChange={e => aggiorna(i, 'anno', e.target.value)}
              className="w-20 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            <input type="text" value={r.id} onChange={e => aggiorna(i, 'id', e.target.value)} placeholder="URL o ID del foglio"
              className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            {idFoglio(r.id) && (
              <a href={`https://docs.google.com/spreadsheets/d/${idFoglio(r.id)}/edit`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-emerald-600 hover:underline shrink-0">Apri</a>
            )}
            <button type="button" onClick={() => setRighe(x => x.filter((_, j) => j !== i))} title="Togli"
              className="text-gray-400 hover:text-red-600 shrink-0"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button type="button" onClick={aggiungi}
          className="flex items-center gap-1 border border-gray-300 px-2.5 py-1.5 rounded text-xs hover:bg-gray-50">
          <Plus size={12} /> Anno
        </button>
        <button type="button" onClick={salva} disabled={salvando}
          className="flex items-center gap-1 bg-emerald-600 text-white px-2.5 py-1.5 rounded text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
          {salvando && <Loader2 size={12} className="animate-spin" />} Salva fogli
        </button>
        {msg && <span className={`text-xs ${msg === 'Salvato' ? 'text-emerald-600' : 'text-red-600'}`}>{msg}</span>}
      </div>
    </div>
  );
}
