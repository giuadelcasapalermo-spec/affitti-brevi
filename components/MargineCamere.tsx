'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDays, differenceInDays, format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronDown } from 'lucide-react';
import { BiancheriaStanza, CAPI_BIANCHERIA, Camera, CapoBiancheria, Prenotazione } from '@/lib/types';
import { COSTO_CAMBIO_STANZA, COSTO_PULIZIA_CHECKOUT, TipoPulizia, costoPulizia, puliziaGiorno, ricavoNotte } from '@/lib/pulizie';
import { getCameraStyle } from '@/lib/camera-colors';

type Cella = { ricavo: number; lavanderia: number; pulizia: number; tipo?: TipoPulizia; margine: number };

const euro = (v: number) => `${v < 0 ? '-' : ''}€${Math.abs(v).toFixed(2)}`;
// Dettaglio giornaliero: euro interi; il simbolo € compare solo da desktop (su mobile manca spazio)
function Euro0({ v }: { v: number }) {
  const n = Math.round(v);
  return <>{n < 0 ? '-' : ''}<span className="hidden sm:inline">€</span>{Math.abs(n)}</>;
}

// Margine lordo giornaliero per stanza: ricavo della notte (come nel calendario, tassa di soggiorno
// esclusa perché partita di giro) − lavanderia (biancheria segnata dalla collaboratrice × listino)
// − costo pulizia della collaboratrice per stanza pulita. Costi indiretti non ancora ribaltati.
export default function MargineCamere({ prenotazioni, camere, dal, al }: {
  prenotazioni: Prenotazione[];
  camere: Camera[];
  dal: string;
  al: string;
}) {
  const [biancheria, setBiancheria] = useState<BiancheriaStanza[]>([]);
  const [prezzi, setPrezzi] = useState<Record<CapoBiancheria, number> | null>(null);
  const [dettaglio, setDettaglio] = useState(false);

  useEffect(() => {
    if (!dal || !al || dal > al) return; // periodo non valido: nessun giorno da calcolare
    fetch(`/api/biancheria?dal=${dal}&al=${al}`)
      .then((r) => r.json())
      .then((d) => setBiancheria(Array.isArray(d) ? d : []))
      .catch(() => setBiancheria([]));
  }, [dal, al]);

  useEffect(() => {
    fetch('/api/biancheria/prezzi')
      .then((r) => r.json())
      .then((d) => setPrezzi(d && typeof d === 'object' && !('error' in d) ? d : null))
      .catch(() => setPrezzi(null));
  }, []);

  const { giorni, celle, lavNonAttribuita } = useMemo(() => {
    const giorni: string[] = [];
    if (dal && al && dal <= al) {
      const n = differenceInDays(parseISO(al), parseISO(dal)) + 1;
      for (let i = 0; i < n; i++) giorni.push(format(addDays(parseISO(dal), i), 'yyyy-MM-dd'));
    }
    const costoRiga = (r: BiancheriaStanza) =>
      CAPI_BIANCHERIA.reduce((s, c) => s + (Number(r[c.key]) || 0) * (prezzi?.[c.key] ?? 0), 0);
    const lavPer = new Map<string, number>(); // `${giorno}|${camera}` → costo
    let lavNonAttribuita = 0;
    for (const r of biancheria) {
      if (r.camera_id === 0) { lavNonAttribuita += costoRiga(r); continue; }
      const k = `${r.data}|${r.camera_id}`;
      lavPer.set(k, (lavPer.get(k) ?? 0) + costoRiga(r));
    }
    const celle = new Map<string, Cella>();
    for (const g of giorni) {
      const pulizie = puliziaGiorno(prenotazioni, g);
      for (const c of camere) {
        const k = `${g}|${c.id}`;
        const ricavo = ricavoNotte(prenotazioni, c.id, g);
        const lavanderia = lavPer.get(k) ?? 0;
        const tipo = pulizie.get(c.id);
        const pulizia = costoPulizia(tipo);
        celle.set(k, { ricavo, lavanderia, pulizia, tipo, margine: ricavo - lavanderia - pulizia });
      }
    }
    return { giorni, celle, lavNonAttribuita };
  }, [dal, al, prenotazioni, camere, biancheria, prezzi]);

  const totaliCamera = camere.map((c) => {
    const t = { ricavo: 0, lavanderia: 0, pulizia: 0, margine: 0, checkout: 0, cambi: 0 };
    for (const g of giorni) {
      const x = celle.get(`${g}|${c.id}`);
      if (!x) continue;
      t.ricavo += x.ricavo; t.lavanderia += x.lavanderia; t.pulizia += x.pulizia; t.margine += x.margine;
      if (x.tipo === 'checkout') t.checkout++;
      if (x.tipo === 'cambio') t.cambi++;
    }
    return { camera: c, ...t };
  });
  const tot = totaliCamera.reduce(
    (s, t) => ({
      ricavo: s.ricavo + t.ricavo, lavanderia: s.lavanderia + t.lavanderia, pulizia: s.pulizia + t.pulizia,
      margine: s.margine + t.margine, checkout: s.checkout + t.checkout, cambi: s.cambi + t.cambi,
    }),
    { ricavo: 0, lavanderia: 0, pulizia: 0, margine: 0, checkout: 0, cambi: 0 },
  );
  const titoloPulizie = (checkout: number, cambi: number) =>
    `${checkout} check-out × €${COSTO_PULIZIA_CHECKOUT} + ${cambi} cambi × €${COSTO_CAMBIO_STANZA}`;
  const pct = (m: number, r: number) => (r > 0 ? `${Math.round((m / r) * 100)}%` : '—');
  const giorniConValori = giorni.filter((g) => camere.some((c) => {
    const x = celle.get(`${g}|${c.id}`);
    return x && (x.ricavo || x.lavanderia || x.pulizia);
  }));

  return (
    <div className="bg-white rounded-lg shadow-sm p-3 sm:p-5 space-y-3">
      <div>
        <h2 className="font-semibold text-gray-700 text-sm sm:text-base">Margine lordo per stanza</h2>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Ricavo notte (tassa di soggiorno esclusa) − lavanderia (biancheria segnata × listino) − pulizie (€{COSTO_PULIZIA_CHECKOUT} per check-out, €{COSTO_CAMBIO_STANZA} per cambio).
          Costi indiretti non ancora ribaltati.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm tabular-nums">
          <thead>
            <tr className="text-[10px] sm:text-xs text-gray-400 border-b">
              <th className="text-left font-normal pb-1">Stanza</th>
              <th className="text-right font-normal pb-1">Ricavo</th>
              <th className="text-right font-normal pb-1">Lavanderia</th>
              <th className="text-right font-normal pb-1">Pulizie</th>
              <th className="text-right font-normal pb-1">Margine</th>
              <th className="text-right font-normal pb-1">%</th>
            </tr>
          </thead>
          <tbody>
            {totaliCamera.map((t) => {
              const col = getCameraStyle(t.camera.id, t.camera.colore);
              return (
                <tr key={t.camera.id} className="border-b border-gray-50">
                  <td className={`py-1.5 font-semibold ${col.testo}`}>{t.camera.nome}</td>
                  <td className="py-1.5 text-right text-gray-700">{euro(t.ricavo)}</td>
                  <td className="py-1.5 text-right text-gray-500">{t.lavanderia > 0 ? `-${euro(t.lavanderia)}` : '—'}</td>
                  <td className="py-1.5 text-right text-gray-500" title={titoloPulizie(t.checkout, t.cambi)}>
                    {t.pulizia > 0 ? `-${euro(t.pulizia)}` : '—'}
                    {t.pulizia > 0 && (
                      <div className="text-[10px] text-gray-400 leading-tight">{t.checkout} CO · {t.cambi} cambi</div>
                    )}
                  </td>
                  <td className={`py-1.5 text-right font-semibold ${t.margine >= 0 ? 'text-green-700' : 'text-red-600'}`}>{euro(t.margine)}</td>
                  <td className="py-1.5 text-right text-gray-400">{pct(t.margine, t.ricavo)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold text-gray-800">
              <td className="pt-2">Totale</td>
              <td className="pt-2 text-right">{euro(tot.ricavo)}</td>
              <td className="pt-2 text-right">{tot.lavanderia > 0 ? `-${euro(tot.lavanderia)}` : '—'}</td>
              <td className="pt-2 text-right" title={titoloPulizie(tot.checkout, tot.cambi)}>{tot.pulizia > 0 ? `-${euro(tot.pulizia)}` : '—'}</td>
              <td className={`pt-2 text-right ${tot.margine >= 0 ? 'text-green-700' : 'text-red-600'}`}>{euro(tot.margine)}</td>
              <td className="pt-2 text-right text-gray-400">{pct(tot.margine, tot.ricavo)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {lavNonAttribuita > 0 && (
        <p className="text-[11px] text-gray-400">
          Lavanderia da buoni non attribuita alle stanze (esclusa dal margine): {euro(lavNonAttribuita)}
        </p>
      )}
      {prezzi && Object.values(prezzi).every((v) => !v) && biancheria.length > 0 && (
        <p className="text-[11px] text-amber-700">Listino lavanderia vuoto: il costo lavanderia risulta zero.</p>
      )}

      <button onClick={() => setDettaglio((d) => !d)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
        <ChevronDown size={14} className={`transition-transform ${dettaglio ? 'rotate-180' : ''}`} />
        Dettaglio giornaliero
      </button>

      {dettaglio && (
        giorniConValori.length === 0 ? (
          <p className="text-xs text-gray-400">Nessun ricavo o costo nel periodo</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-[10px] sm:text-xs tabular-nums">
              <thead>
                <tr className="text-gray-400 border-b">
                  <th className="w-9 sm:w-20 text-left font-normal pb-1 pr-1">Gg</th>
                  {camere.map((c) => (
                    <th key={c.id} className={`text-right font-semibold pb-1 px-0.5 truncate ${getCameraStyle(c.id, c.colore).testo}`}>
                      <span className="sm:hidden">{c.nome.slice(0, 3)}</span><span className="hidden sm:inline">{c.nome}</span>
                    </th>
                  ))}
                  <th className="w-11 sm:w-16 text-right font-normal pb-1 pl-1">Tot.<span className="sm:hidden"> €</span></th>
                </tr>
              </thead>
              <tbody>
                {giorniConValori.map((g) => {
                  const totGiorno = camere.reduce((s, c) => s + (celle.get(`${g}|${c.id}`)?.margine ?? 0), 0);
                  return (
                    <tr key={g} className="border-b border-gray-50">
                      <td className="py-1 pr-1 text-gray-500">
                        <span className="hidden sm:inline capitalize">{format(parseISO(g), 'EEE', { locale: it })} </span>
                        {parseInt(g.slice(8), 10)}/{parseInt(g.slice(5, 7), 10)}
                      </td>
                      {camere.map((c) => {
                        const x = celle.get(`${g}|${c.id}`);
                        if (!x || (!x.ricavo && !x.lavanderia && !x.pulizia)) {
                          return <td key={c.id} className="py-1 px-0.5 text-right text-gray-300">—</td>;
                        }
                        return (
                          <td
                            key={c.id}
                            className={`py-1 px-0.5 text-right ${x.margine >= 0 ? 'text-gray-700' : 'text-red-600'}`}
                            title={`Ricavo ${euro(x.ricavo)} − lavanderia ${euro(x.lavanderia)} − ${x.tipo === 'cambio' ? 'cambio' : 'pulizia check-out'} ${euro(x.pulizia)}`}
                          >
                            <Euro0 v={x.margine} />
                          </td>
                        );
                      })}
                      <td className={`py-1 pl-1 text-right font-semibold ${totGiorno >= 0 ? 'text-green-700' : 'text-red-600'}`}><Euro0 v={totGiorno} /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="font-semibold border-t">
                  <td className="pt-1.5 pr-1 text-gray-500">Tot</td>
                  {totaliCamera.map((t) => (
                    <td key={t.camera.id} className={`pt-1.5 px-0.5 text-right ${t.margine >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                      <Euro0 v={t.margine} />
                    </td>
                  ))}
                  <td className={`pt-1.5 pl-1 text-right ${tot.margine >= 0 ? 'text-green-700' : 'text-red-600'}`}><Euro0 v={tot.margine} /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      )}
    </div>
  );
}
