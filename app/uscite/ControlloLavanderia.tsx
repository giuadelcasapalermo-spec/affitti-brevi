'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Shirt } from 'lucide-react';
import { CAPI_BIANCHERIA, CapoBiancheria, BiancheriaStanza, Uscita } from '@/lib/types';

// Confronta le uscite "Lavanderia" del periodo con il costo atteso calcolato dalla biancheria
// inserita dalla collaboratrice (quantità × listino prezzi).
export default function ControlloLavanderia({ dal, al, uscite }: { dal: string; al: string; uscite: Uscita[] }) {
  const [righe, setRighe] = useState<BiancheriaStanza[]>([]);
  const [prezzi, setPrezzi] = useState<Record<string, string>>({});
  const [prezziSalvati, setPrezziSalvati] = useState<Record<string, string>>({});
  const [aperto, setAperto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch(`/api/biancheria?dal=${dal}&al=${al}`)
      .then((r) => r.json())
      .then((d) => setRighe(Array.isArray(d) ? d : []))
      .catch(() => setRighe([]));
  }, [dal, al]);

  useEffect(() => {
    fetch('/api/biancheria/prezzi')
      .then((r) => r.json())
      .then((d: Record<CapoBiancheria, number>) => {
        const s = Object.fromEntries(CAPI_BIANCHERIA.map((c) => [c.key, d?.[c.key] ? d[c.key].toFixed(2) : '']));
        setPrezzi(s);
        setPrezziSalvati(s);
      })
      .catch(() => {});
  }, []);

  const prezzo = (k: CapoBiancheria) => parseFloat((prezzi[k] ?? '').replace(',', '.')) || 0;
  const dettaglio = CAPI_BIANCHERIA.map((c) => {
    const qta = righe.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
    return { ...c, qta, totale: qta * prezzo(c.key) };
  });
  const atteso = dettaglio.reduce((s, d) => s + d.totale, 0);
  const speseLav = uscite.filter((u) => u.categoria === 'Lavanderia' && u.data >= dal && u.data <= al);
  const registrato = speseLav.reduce((s, u) => s + u.importo, 0);
  const diff = registrato - atteso;
  const quadra = Math.abs(diff) < 0.005;
  const giorni = new Set(righe.map((r) => r.data)).size;
  const prezziModificati = CAPI_BIANCHERIA.some((c) => (prezzi[c.key] ?? '') !== (prezziSalvati[c.key] ?? ''));
  const prezziMancanti = dettaglio.some((d) => d.qta > 0 && prezzo(d.key) === 0);

  if (righe.length === 0 && speseLav.length === 0) return null;

  async function salvaPrezzi() {
    setSalvando(true);
    try {
      const body = Object.fromEntries(CAPI_BIANCHERIA.map((c) => [c.key, prezzo(c.key)]));
      await fetch('/api/biancheria/prezzi', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      setPrezziSalvati({ ...prezzi });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm no-print">
      <button onClick={() => setAperto((a) => !a)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <div className="bg-sky-100 rounded-full p-2 shrink-0"><Shirt size={18} className="text-sky-600" /></div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-700">Controllo lavanderia</div>
          <div className="text-xs text-gray-500 flex flex-wrap gap-x-3">
            <span>Registrato <strong className="text-gray-700">€{registrato.toFixed(2)}</strong></span>
            <span>Atteso <strong className="text-gray-700">€{atteso.toFixed(2)}</strong></span>
            <span className={quadra ? 'text-green-600' : 'text-red-600'}>
              {quadra ? 'quadra' : `diff. ${diff > 0 ? '+' : ''}€${diff.toFixed(2)}`}
            </span>
          </div>
        </div>
        <ChevronDown size={18} className={`text-gray-400 transition-transform ${aperto ? 'rotate-180' : ''}`} />
      </button>

      {aperto && (
        <div className="px-4 pb-4 border-t pt-3 space-y-3">
          <p className="text-xs text-gray-500">
            Biancheria inserita dalla collaboratrice in {giorni} {giorni === 1 ? 'giorno' : 'giorni'} ({righe.length} pulizie stanza)
            {' · '}{speseLav.length} {speseLav.length === 1 ? 'uscita' : 'uscite'} Lavanderia in Prima Nota
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b">
                <th className="text-left font-normal pb-1">Capo</th>
                <th className="text-right font-normal pb-1">Q.tà</th>
                <th className="text-right font-normal pb-1">Prezzo €</th>
                <th className="text-right font-normal pb-1">Totale</th>
              </tr>
            </thead>
            <tbody>
              {dettaglio.map((d) => (
                <tr key={d.key} className="border-b border-gray-50">
                  <td className="py-1 text-gray-700">{d.label}</td>
                  <td className="py-1 text-right text-gray-700">{d.qta}</td>
                  <td className="py-1 text-right">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={prezzi[d.key] ?? ''}
                      onChange={(e) => setPrezzi((p) => ({ ...p, [d.key]: e.target.value }))}
                      className={`w-20 text-right border rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400 ${
                        d.qta > 0 && prezzo(d.key) === 0 ? 'border-amber-300 bg-amber-50' : 'border-gray-300'
                      }`}
                    />
                  </td>
                  <td className="py-1 text-right text-gray-700">€{d.totale.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-gray-800">
                <td className="pt-2" colSpan={3}>Costo atteso</td>
                <td className="pt-2 text-right">€{atteso.toFixed(2)}</td>
              </tr>
              <tr className="font-semibold text-gray-800">
                <td colSpan={3}>Registrato in Prima Nota</td>
                <td className="text-right">€{registrato.toFixed(2)}</td>
              </tr>
              <tr className={`font-semibold ${quadra ? 'text-green-600' : 'text-red-600'}`}>
                <td colSpan={3}>Differenza</td>
                <td className="text-right">{quadra ? 'quadra' : `${diff > 0 ? '+' : ''}€${diff.toFixed(2)}`}</td>
              </tr>
            </tfoot>
          </table>
          {prezziMancanti && (
            <p className="text-xs text-amber-700">Alcuni capi hanno quantità ma nessun prezzo: completa il listino.</p>
          )}
          {prezziModificati && (
            <div className="flex justify-end">
              <button
                onClick={salvaPrezzi}
                disabled={salvando}
                className="px-3 py-1.5 text-sm bg-sky-600 text-white rounded hover:bg-sky-700 disabled:opacity-50"
              >
                Salva listino
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
