// Ospiti registrati (alloggiati) per prenotazione, ai fini della tassa di soggiorno.
// I minori sotto ETA_ESENZIONE_TASSA anni alla data di arrivo sono esenti in automatico.
import sql from './postgres';

/** Età sotto la quale l'ospite è esente dalla tassa di soggiorno (Palermo: minori di 10 anni) */
export const ETA_ESENZIONE_TASSA = 10;

export interface OspitiPrenotazione {
  /** Documenti caricati */
  n: number;
  /** Di cui minori di ETA_ESENZIONE_TASSA anni al giorno di arrivo */
  minori: number;
}

export async function contaOspitiPerPrenotazione(strutturaId: string, dal: string, al: string): Promise<Record<string, OspitiPrenotazione>> {
  // Date in formato ISO (AAAA-MM-GG); una data di nascita mancante o non valida non rende esente
  const rows = await sql`
    SELECT prenotazione_id,
           COUNT(*)::int AS n,
           COUNT(*) FILTER (
             WHERE data_nascita ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND data_arrivo ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
               -- confronto tra date, non tra intervalli (age() < '10 years' sbaglia: 9a 11m 30g vale 10 anni)
               AND data_nascita::date > data_arrivo::date - make_interval(years => ${ETA_ESENZIONE_TASSA}::int)
           )::int AS minori
    FROM alloggiati
    WHERE struttura_id = ${strutturaId}
      AND data_arrivo >= ${dal}
      AND data_arrivo <= ${al}
    GROUP BY prenotazione_id
  `;
  const ospiti: Record<string, OspitiPrenotazione> = {};
  for (const r of rows) ospiti[r.prenotazione_id as string] = { n: r.n as number, minori: r.minori as number };
  return ospiti;
}

/**
 * Esenti di una prenotazione: i minori calcolati dai documenti, oppure il numero inserito a mano
 * nel prospetto se è maggiore (per altre esenzioni). Non si sommano, per non contare due volte i bambini.
 */
export function esentiPrenotazione(manuali: number, o: OspitiPrenotazione | undefined): number {
  return Math.max(manuali, o?.minori ?? 0);
}
