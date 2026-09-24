'use client';

import { useEffect, useState } from 'react';
import { Scale, Shirt, TrendingDown } from 'lucide-react';
import { CAPI_BIANCHERIA, CapoBiancheria, BiancheriaStanza, Uscita } from '@/lib/types';
import { fData } from '@/lib/utils';

// Confronta le uscite "Lavanderia" del periodo filtrato con il costo atteso calcolato dalla biancheria
// inserita dalla collaboratrice nello stesso periodo (quantità × listino prezzi).
export default function ControlloLavanderia({ dal, al, uscite }: { dal: string; al: string; uscite: Uscita[] }) {
  const [righe, setRighe] = useState<BiancheriaStanza[]>([]);
  const [prezzi, setPrezzi] = useState<Record<string, string>>({});
  const [prezziSalvati, setPrezziSalvati] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!dal || !al || dal > al) return; // periodo non valido
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
  // Lenzuola singole in fondo (dopo piumone): voce usata raramente
  const capiOrdinati = [...CAPI_BIANCHERIA.filter((c) => c.key !== 'lenz_sing'), ...CAPI_BIANCHERIA.filter((c) => c.key === 'lenz_sing')];
  const dettaglio = capiOrdinati.map((c) => {
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
  const diffLabel = quadra ? 'quadra' : `${diff > 0 ? '+' : ''}€${diff.toFixed(2)}`;

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
    <div className="space-y-4">
      {/* Totali: stessa grafica dei KPI di dashboard e Prima Nota */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white rounded-lg shadow-sm p-2.5 sm:p-4 flex items-center gap-3">
          <div className="hidden sm:block bg-red-100 rounded-full p-2 shrink-0"><TrendingDown size={20} className="text-red-600" /></div>
          <div className="min-w-0">
            <div className="text-[11px] sm:text-sm text-gray-500">Registrato</div>
            <div className="text-base sm:text-lg font-bold text-red-600 truncate">€{registrato.toFixed(2)}</div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-2.5 sm:p-4 flex items-center gap-3">
          <div className="hidden sm:block bg-sky-100 rounded-full p-2 shrink-0"><Shirt size={20} className="text-sky-600" /></div>
          <div className="min-w-0">
            <div className="text-[11px] sm:text-sm text-gray-500">Atteso</div>
            <div className="text-base sm:text-lg font-bold text-gray-800 truncate">€{atteso.toFixed(2)}</div>
          </div>
        </div>
        <div className={`rounded-lg shadow-sm p-2.5 sm:p-4 flex items-center gap-3 ${quadra ? 'bg-white' : 'bg-red-50'}`}>
          <div className={`hidden sm:block rounded-full p-2 shrink-0 ${quadra ? 'bg-green-100' : 'bg-red-100'}`}>
            <Scale size={20} className={quadra ? 'text-green-600' : 'text-red-600'} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] sm:text-sm text-gray-500">Differenza</div>
            <div className={`text-base sm:text-lg font-bold truncate ${quadra ? 'text-green-700' : 'text-red-600'}`}>{diffLabel}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 space-y-3 no-print">
        <p className="text-xs text-gray-500">
          {fData(dal)} – {fData(al)} · biancheria inserita dalla collaboratrice in {giorni} {giorni === 1 ? 'giorno' : 'giorni'} ({righe.length} righe)
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
          </tfoot>
        </table>
        {!quadra && (
          <p className="text-xs text-gray-500">
            Le ricevute portano la data di consegna: una differenza negativa pari agli ultimi ritiri non ancora
            fatturati è normale.
          </p>
        )}
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
    </div>
  );
}
