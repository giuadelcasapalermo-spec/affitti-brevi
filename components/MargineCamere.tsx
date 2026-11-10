'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDays, differenceInDays, format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronDown } from 'lucide-react';
import { BiancheriaStanza, CAPI_BIANCHERIA, Camera, CapoBiancheria, Prenotazione } from '@/lib/types';
import { COSTI_PULIZIA_DEFAULT, CostiPulizia, TipoPulizia, costoPulizia, puliziaGiorno, ricavoNotte } from '@/lib/pulizie';
import { useStruttura } from '@/hooks/useStruttura';
import { getCameraStyle } from '@/lib/camera-colors';

type Cella = { ricavo: number; lavanderia: number; pulizia: number; tipo?: TipoPulizia; margine: number };

const euro = (v: number) => `${v < 0 ? '-' : ''}€${Math.abs(v).toFixed(2)}`;
// Dettaglio giornaliero: euro interi; il simbolo € compare solo da desktop (su mobile manca spazio)
function Euro0({ v }: { v: number }) {
  const n = Math.round(v);
  return <>{n < 0 ? '-' : ''}<span className="hidden sm:inline">€</span>{Math.abs(n)}</>;
}

// Margine lordo giornaliero per stanza: quota di ricavo della notte (come nel calendario, tassa di soggiorno
// esclusa perché partita di giro) − lavanderia (biancheria segnata dalla collaboratrice × listino)
// − costo pulizia della collaboratrice per stanza pulita. Lavanderia e pulizie si attribuiscono al
// soggiorno e si ripartiscono sulle sue notti come il ricavo. Costi indiretti non ancora ribaltati.
export default function MargineCamere({ prenotazioni, camere, dal, al }: {
  prenotazioni: Prenotazione[];
  camere: Camera[];
  dal: string;
  al: string;
}) {
  const { struttura } = useStruttura();
  const costoCheckout = struttura?.regole.costo_pulizia_checkout ?? COSTI_PULIZIA_DEFAULT.checkout;
  const costoCambio = struttura?.regole.costo_cambio_stanza ?? COSTI_PULIZIA_DEFAULT.cambio;
  const costi: CostiPulizia = useMemo(
    () => ({ checkout: costoCheckout, cambio: costoCambio }),
    [costoCheckout, costoCambio],
  );
  const [biancheria, setBiancheria] = useState<BiancheriaStanza[]>([]);
  const [prezzi, setPrezzi] = useState<Record<CapoBiancheria, number> | null>(null);
  const [dettaglio, setDettaglio] = useState(false);

  // Soggiorni con almeno una notte nel periodo: i loro costi (pulizie e lavanderia, anche se cadono
  // fuori dal periodo) si ripartiscono sulle notti, quindi servono i giorni dal primo check-in
  // all'ultimo check-out
  const soggiorni = useMemo(
    () => prenotazioni.filter((p) => p.stato !== 'cancellata' && p.check_in <= al && p.check_out > dal),
    [prenotazioni, dal, al],
  );
  const estDal = soggiorni.reduce((m, p) => (p.check_in < m ? p.check_in : m), dal);
  const estAl = soggiorni.reduce((m, p) => (p.check_out > m ? p.check_out : m), al);

  useEffect(() => {
    if (!estDal || !estAl || estDal > estAl) return; // periodo non valido: nessun giorno da calcolare
    fetch(`/api/biancheria?dal=${estDal}&al=${estAl}`)
      .then((r) => r.json())
      .then((d) => setBiancheria(Array.isArray(d) ? d : []))
      .catch(() => setBiancheria([]));
  }, [estDal, estAl]);

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
    // Costi ripartiti per notte con lo stesso criterio del ricavo: un costo del giorno g va al
    // soggiorno a cui appartiene (quello che parte in g, altrimenti quello in corso) e si divide
    // sulle sue notti, dal check-in alla notte prima del check-out. Senza soggiorno resta sul giorno.
    const lavPer = new Map<string, number>(); // `${giorno}|${camera}` → costo ripartito
    const pulPer = new Map<string, number>();
    const aggiungi = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
    const ripartisci = (m: Map<string, number>, g: string, cameraId: number, costo: number) => {
      if (!costo) return;
      const p = prenotazioni.find((x) => x.camera_id === cameraId && x.stato !== 'cancellata' && x.check_out === g)
        ?? prenotazioni.find((x) => x.camera_id === cameraId && x.stato !== 'cancellata' && x.check_in <= g && x.check_out > g);
      const n = p ? differenceInDays(parseISO(p.check_out), parseISO(p.check_in)) : 0;
      if (!p || n <= 0) { aggiungi(m, `${g}|${cameraId}`, costo); return; }
      for (let i = 0; i < n; i++) aggiungi(m, `${format(addDays(parseISO(p.check_in), i), 'yyyy-MM-dd')}|${cameraId}`, costo / n);
    };
    let lavNonAttribuita = 0;
    for (const r of biancheria) {
      if (r.camera_id === 0) { if (r.data >= dal && r.data <= al) lavNonAttribuita += costoRiga(r); continue; }
      ripartisci(lavPer, r.data, r.camera_id, costoRiga(r));
    }
    // pulizie: tutti i giorni dal primo check-in all'ultimo check-out dei soggiorni del periodo
    const tipoPer = new Map<string, TipoPulizia>(); // tipo di pulizia fatta nel giorno (per i conteggi)
    if (estDal && estAl && estDal <= estAl) {
      const nEst = differenceInDays(parseISO(estAl), parseISO(estDal)) + 1;
      for (let i = 0; i < nEst; i++) {
        const g = format(addDays(parseISO(estDal), i), 'yyyy-MM-dd');
        for (const [cameraId, tipo] of puliziaGiorno(prenotazioni, g)) {
          tipoPer.set(`${g}|${cameraId}`, tipo);
          ripartisci(pulPer, g, cameraId, costoPulizia(tipo, costi));
        }
      }
    }
    const celle = new Map<string, Cella>();
    for (const g of giorni) {
      for (const c of camere) {
        const k = `${g}|${c.id}`;
        const ricavo = ricavoNotte(prenotazioni, c.id, g);
        const lavanderia = lavPer.get(k) ?? 0;
        const pulizia = pulPer.get(k) ?? 0;
        celle.set(k, { ricavo, lavanderia, pulizia, tipo: tipoPer.get(k), margine: ricavo - lavanderia - pulizia });
      }
    }
    return { giorni, celle, lavNonAttribuita };
  }, [dal, al, estDal, estAl, prenotazioni, camere, biancheria, prezzi, costi]);

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
    `${checkout} check-out e ${cambi} cambi nel periodo; costo ripartito sulle notti dei soggiorni`;
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
          Ricavo ripartito per notte come nel calendario (tassa di soggiorno esclusa) − lavanderia (biancheria segnata × listino) − pulizie (€{costi.checkout} per check-out, €{costi.cambio} per cambio).
          Lavanderia e pulizie sono attribuite al soggiorno e ripartite sulle sue notti, come il ricavo.
          Costi indiretti non ancora ribaltati.
        </p>
      </div>

      {/* Totali del periodo: ricavo − lavanderia − pulizie = margine */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { etichetta: 'Ricavo', valore: euro(tot.ricavo), nota: 'quota notti del periodo', cls: 'text-gray-800', bg: 'bg-gray-50' },
          { etichetta: 'Lavanderia', valore: tot.lavanderia > 0 ? `-${euro(tot.lavanderia)}` : '—', nota: pct(tot.lavanderia, tot.ricavo) + ' del ricavo', cls: 'text-sky-700', bg: 'bg-sky-50' },
          { etichetta: 'Pulizie', valore: tot.pulizia > 0 ? `-${euro(tot.pulizia)}` : '—', nota: pct(tot.pulizia, tot.ricavo) + ' del ricavo', cls: 'text-pink-700', bg: 'bg-pink-50' },
          { etichetta: 'Margine', valore: euro(tot.margine), nota: pct(tot.margine, tot.ricavo) + ' del ricavo', cls: tot.margine >= 0 ? 'text-green-700' : 'text-red-600', bg: tot.margine >= 0 ? 'bg-green-50' : 'bg-red-50' },
        ].map((k) => (
          <div key={k.etichetta} className={`rounded-lg px-3 py-2 ${k.bg}`}>
            <div className="text-[11px] text-gray-500">{k.etichetta}</div>
            <div className={`text-base sm:text-lg font-bold tabular-nums ${k.cls}`}>{k.valore}</div>
            <div className="text-[10px] text-gray-400">{k.nota}</div>
          </div>
        ))}
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
                            title={`Ricavo ${euro(x.ricavo)} − lavanderia ${euro(x.lavanderia)} − pulizie ${euro(x.pulizia)} (quote per notte)`}
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
                {([
                  { k: 'ricavo', label: 'Ric.', titolo: 'Ricavo', cls: 'text-gray-700', segno: 1 },
                  { k: 'lavanderia', label: 'Lav.', titolo: 'Lavanderia', cls: 'text-sky-700', segno: -1 },
                  { k: 'pulizia', label: 'Pul.', titolo: 'Pulizie', cls: 'text-pink-700', segno: -1 },
                ] as const).map((r, i) => (
                  <tr key={r.k} className={i === 0 ? 'border-t' : ''}>
                    <td className="pt-1 pr-1 text-gray-500" title={r.titolo}>
                      <span className="sm:hidden">{r.label}</span><span className="hidden sm:inline">{r.titolo}</span>
                    </td>
                    {totaliCamera.map((t) => (
                      <td key={t.camera.id} className={`pt-1 px-0.5 text-right ${r.cls}`}><Euro0 v={r.segno * t[r.k]} /></td>
                    ))}
                    <td className={`pt-1 pl-1 text-right font-semibold ${r.cls}`}><Euro0 v={r.segno * tot[r.k]} /></td>
                  </tr>
                ))}
                <tr className="font-semibold border-t">
                  <td className="pt-1.5 pr-1 text-gray-500"><span className="sm:hidden">Marg.</span><span className="hidden sm:inline">Margine</span></td>
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
