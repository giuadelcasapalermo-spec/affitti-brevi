'use client';

import { useMemo, useState } from 'react';
import { addDays, differenceInDays, format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronDown, Scale, Sparkles, TrendingDown } from 'lucide-react';
import { Camera, Prenotazione, Uscita } from '@/lib/types';
import { COSTI_PULIZIA_DEFAULT, puliziaGiorno, type TipoPulizia } from '@/lib/pulizie';
import { useStruttura } from '@/hooks/useStruttura';
import { getCameraStyle } from '@/lib/camera-colors';

const euro = (v: number) => `€${v.toFixed(2)}`;

// Costo della cameriera nel periodo: pulizie complete (giorno di check-out, quando la stanza si
// libera per il nuovo arrivo) e cambi durante i soggiorni lunghi, × tariffario della struttura
// (Impostazioni → Strutture → Tariffario cameriera). Confronto con le uscite "Pulizie" registrate.
export default function PulizieCameriera({ dal, al, prenotazioni, camere, uscite }: {
  dal: string;
  al: string;
  prenotazioni: Prenotazione[];
  camere: Camera[];
  uscite: Uscita[];
}) {
  const { struttura } = useStruttura();
  const tariffaPulizia = struttura?.regole.costo_pulizia_checkout ?? COSTI_PULIZIA_DEFAULT.checkout;
  const tariffaCambio = struttura?.regole.costo_cambio_stanza ?? COSTI_PULIZIA_DEFAULT.cambio;
  const [dettaglio, setDettaglio] = useState(false);

  const giorni = useMemo(() => {
    const out: { giorno: string; pulizie: { camera: Camera; tipo: TipoPulizia }[] }[] = [];
    if (!dal || !al || dal > al) return out;
    const n = differenceInDays(parseISO(al), parseISO(dal)) + 1;
    for (let i = 0; i < n; i++) {
      const g = format(addDays(parseISO(dal), i), 'yyyy-MM-dd');
      const mappa = puliziaGiorno(prenotazioni, g);
      const pulizie = camere.filter((c) => mappa.has(c.id)).map((c) => ({ camera: c, tipo: mappa.get(c.id)! }));
      if (pulizie.length) out.push({ giorno: g, pulizie });
    }
    return out;
  }, [dal, al, prenotazioni, camere]);

  const costo = (t: TipoPulizia) => (t === 'checkout' ? tariffaPulizia : tariffaCambio);
  const perCamera = camere.map((c) => {
    let complete = 0, cambi = 0;
    for (const g of giorni) for (const p of g.pulizie) {
      if (p.camera.id !== c.id) continue;
      if (p.tipo === 'checkout') complete++; else cambi++;
    }
    return { camera: c, complete, cambi, totale: complete * tariffaPulizia + cambi * tariffaCambio };
  });
  const tot = perCamera.reduce((s, x) => ({ complete: s.complete + x.complete, cambi: s.cambi + x.cambi, totale: s.totale + x.totale }),
    { complete: 0, cambi: 0, totale: 0 });
  const pagato = uscite.filter((u) => u.categoria === 'Pulizie' && u.data >= dal && u.data <= al).reduce((s, u) => s + u.importo, 0);
  const diff = pagato - tot.totale;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-sm text-gray-500"><Sparkles size={14} className="text-pink-600" />Costo cameriera</div>
          <div className="text-base sm:text-lg font-bold text-gray-800 mt-0.5">{euro(tot.totale)}</div>
          <div className="text-[10px] sm:text-xs text-gray-400">{tot.complete} pulizie · {tot.cambi} cambi</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-sm text-gray-500"><TrendingDown size={14} className="text-red-600" />Pagato</div>
          <div className="text-base sm:text-lg font-bold text-red-600 mt-0.5">{euro(pagato)}</div>
          <div className="text-[10px] sm:text-xs text-gray-400">uscite &quot;Pulizie&quot;</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-sm text-gray-500"><Scale size={14} className="text-slate-600" />Differenza</div>
          <div className={`text-base sm:text-lg font-bold mt-0.5 ${Math.abs(diff) < 0.5 ? 'text-gray-800' : diff > 0 ? 'text-amber-600' : 'text-blue-700'}`}>
            {diff > 0 ? '+' : ''}{euro(diff)}
          </div>
          <div className="text-[10px] sm:text-xs text-gray-400">{Math.abs(diff) < 0.5 ? 'in pari' : diff > 0 ? 'pagato in più' : 'da pagare'}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-3 sm:p-5 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-700 text-sm sm:text-base">Pulizie per stanza</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Tariffario: €{tariffaPulizia} pulizia completa (al check-out, prima del nuovo arrivo), €{tariffaCambio} cambio durante il soggiorno.
            Si modifica in Impostazioni → Strutture → Tariffario cameriera.
          </p>
        </div>
        <table className="w-full text-xs sm:text-sm tabular-nums">
          <thead>
            <tr className="text-[10px] sm:text-xs text-gray-400 border-b">
              <th className="text-left font-normal pb-1">Stanza</th>
              <th className="text-right font-normal pb-1">Pulizie</th>
              <th className="text-right font-normal pb-1">Cambi</th>
              <th className="text-right font-normal pb-1">Costo</th>
            </tr>
          </thead>
          <tbody>
            {perCamera.map((x) => (
              <tr key={x.camera.id} className="border-b border-gray-50">
                <td className={`py-1.5 font-semibold ${getCameraStyle(x.camera.id, x.camera.colore).testo}`}>{x.camera.nome}</td>
                <td className="py-1.5 text-right text-gray-600">{x.complete} <span className="text-gray-400 text-[10px]">× €{tariffaPulizia}</span></td>
                <td className="py-1.5 text-right text-gray-600">{x.cambi} <span className="text-gray-400 text-[10px]">× €{tariffaCambio}</span></td>
                <td className="py-1.5 text-right font-semibold text-gray-800">{euro(x.totale)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold text-gray-800">
              <td className="pt-2">Totale</td>
              <td className="pt-2 text-right">{tot.complete}</td>
              <td className="pt-2 text-right">{tot.cambi}</td>
              <td className="pt-2 text-right">{euro(tot.totale)}</td>
            </tr>
          </tfoot>
        </table>

        <button onClick={() => setDettaglio((d) => !d)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
          <ChevronDown size={14} className={`transition-transform ${dettaglio ? 'rotate-180' : ''}`} />
          Dettaglio giornaliero
        </button>
        {dettaglio && (giorni.length === 0
          ? <p className="text-xs text-gray-400">Nessuna pulizia nel periodo</p>
          : (
            <div className="divide-y divide-gray-50">
              {giorni.map((g) => (
                <div key={g.giorno} className="flex items-center gap-2 py-1.5 text-xs">
                  <span className="w-16 sm:w-20 flex-shrink-0 text-gray-500 capitalize">{format(parseISO(g.giorno), 'EEE d/M', { locale: it })}</span>
                  <div className="flex flex-wrap gap-1 flex-1">
                    {g.pulizie.map((p) => {
                      const st = getCameraStyle(p.camera.id, p.camera.colore);
                      return (
                        <span key={p.camera.id} className={`px-1.5 py-0.5 rounded ${p.tipo === 'checkout' ? `${st.bar} text-white` : `${st.bg} ${st.testo}`}`}>
                          {p.camera.nome} {p.tipo === 'checkout' ? 'pulizia' : 'cambio'}
                        </span>
                      );
                    })}
                  </div>
                  <span className="w-12 text-right font-semibold text-gray-700 tabular-nums">{euro(g.pulizie.reduce((s, p) => s + costo(p.tipo), 0))}</span>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
