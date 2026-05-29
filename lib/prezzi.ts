import { randomUUID } from 'crypto';
import sql from './postgres';
import type { PrezzoPerPeriodo } from './types';
import { migraStruttura } from './strutture';

async function ensureTable(): Promise<void> {
  await migraStruttura();
  await sql`
    CREATE TABLE IF NOT EXISTS prezzi_periodi (
      id TEXT PRIMARY KEY,
      camera_id INT NOT NULL,
      nome_periodo TEXT NOT NULL DEFAULT '',
      data_inizio TEXT NOT NULL,
      data_fine TEXT NOT NULL,
      prezzo_notte REAL NOT NULL,
      created_at TEXT NOT NULL
    )
  `;
  await sql`ALTER TABLE prezzi_periodi ADD COLUMN IF NOT EXISTS struttura_id TEXT`;
}

export async function leggiPrezziPeriodi(cameraId?: number, strutturaId?: string): Promise<PrezzoPerPeriodo[]> {
  await ensureTable();
  let rows;
  if (strutturaId !== undefined && cameraId !== undefined) {
    rows = await sql`SELECT * FROM prezzi_periodi WHERE struttura_id = ${strutturaId} AND camera_id = ${cameraId} ORDER BY data_inizio`;
  } else if (strutturaId !== undefined) {
    rows = await sql`SELECT * FROM prezzi_periodi WHERE struttura_id = ${strutturaId} ORDER BY camera_id, data_inizio`;
  } else if (cameraId !== undefined) {
    rows = await sql`SELECT * FROM prezzi_periodi WHERE camera_id = ${cameraId} ORDER BY data_inizio`;
  } else {
    rows = await sql`SELECT * FROM prezzi_periodi ORDER BY camera_id, data_inizio`;
  }
  return rows as unknown as PrezzoPerPeriodo[];
}

export async function creaPrezziPeriodo(
  strutturaId: string,
  cameraId: number,
  nomePeriodo: string,
  dataInizio: string,
  dataFine: string,
  prezzoNotte: number
): Promise<PrezzoPerPeriodo> {
  await ensureTable();
  const record: PrezzoPerPeriodo = {
    id: randomUUID(),
    struttura_id: strutturaId,
    camera_id: cameraId,
    nome_periodo: nomePeriodo,
    data_inizio: dataInizio,
    data_fine: dataFine,
    prezzo_notte: prezzoNotte,
    created_at: new Date().toISOString(),
  };
  await sql`
    INSERT INTO prezzi_periodi (id, struttura_id, camera_id, nome_periodo, data_inizio, data_fine, prezzo_notte, created_at)
    VALUES (${record.id}, ${record.struttura_id ?? null}, ${record.camera_id}, ${record.nome_periodo},
            ${record.data_inizio}, ${record.data_fine}, ${record.prezzo_notte}, ${record.created_at})
  `;
  return record;
}

export async function eliminaPrezziPeriodo(id: string): Promise<void> {
  await sql`DELETE FROM prezzi_periodi WHERE id = ${id}`;
}

export async function aggiornaPrezziPeriodo(
  id: string,
  fields: Partial<Pick<PrezzoPerPeriodo, 'nome_periodo' | 'data_inizio' | 'data_fine' | 'prezzo_notte'>>
): Promise<void> {
  if (fields.nome_periodo !== undefined)
    await sql`UPDATE prezzi_periodi SET nome_periodo = ${fields.nome_periodo} WHERE id = ${id}`;
  if (fields.data_inizio !== undefined)
    await sql`UPDATE prezzi_periodi SET data_inizio = ${fields.data_inizio} WHERE id = ${id}`;
  if (fields.data_fine !== undefined)
    await sql`UPDATE prezzi_periodi SET data_fine = ${fields.data_fine} WHERE id = ${id}`;
  if (fields.prezzo_notte !== undefined)
    await sql`UPDATE prezzi_periodi SET prezzo_notte = ${fields.prezzo_notte} WHERE id = ${id}`;
}

// ── Calcolo importo ──────────────────────────────────────────────────────────

export interface RigaPrezzo {
  notti: number;
  prezzo_notte: number;
  nome_periodo: string;
  subtotale: number;
}

export interface CalcoloImporto {
  totale: number;
  righe: RigaPrezzo[];   // dettaglio per periodo applicato
}

/**
 * Calcola l'importo totale per un soggiorno sommando notte per notte il prezzo
 * del periodo applicabile. Se nessun periodo copre una data, usa prezzoBase.
 */
export function calcolaImporto(
  checkIn: string,
  checkOut: string,
  prezziPeriodi: PrezzoPerPeriodo[],
  prezzoBase: number
): CalcoloImporto {
  // genera tutte le notti: da checkIn (incluso) a checkOut (escluso)
  const notti: string[] = [];
  const cur = new Date(checkIn + 'T00:00:00Z');
  const fine = new Date(checkOut + 'T00:00:00Z');
  while (cur < fine) {
    notti.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  if (notti.length === 0) return { totale: 0, righe: [] };

  // raggruppa notti consecutive con stesso prezzo
  const gruppati: { prezzo: number; nome: string; count: number }[] = [];
  for (const notte of notti) {
    const periodo = prezziPeriodi.find(
      p => p.data_inizio <= notte && notte <= p.data_fine
    );
    const prezzo = periodo ? periodo.prezzo_notte : prezzoBase;
    const nome = periodo ? periodo.nome_periodo : 'Prezzo base';
    const last = gruppati[gruppati.length - 1];
    if (last && last.prezzo === prezzo && last.nome === nome) {
      last.count++;
    } else {
      gruppati.push({ prezzo, nome, count: 1 });
    }
  }

  const righe: RigaPrezzo[] = gruppati.map(g => ({
    notti: g.count,
    prezzo_notte: g.prezzo,
    nome_periodo: g.nome,
    subtotale: g.count * g.prezzo,
  }));

  return {
    totale: righe.reduce((s, r) => s + r.subtotale, 0),
    righe,
  };
}
