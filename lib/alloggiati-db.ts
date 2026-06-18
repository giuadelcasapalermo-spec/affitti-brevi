// Operazioni CRUD sugli alloggiati — nessuna dipendenza pesante (no comuni-italiani, no codici-alloggiati).
// Importato dalle rotte che fanno solo lettura/scrittura DB, non dalla generazione file.
// Questo file viene bundlato separatamente dal file generation, riducendo il cold start
// delle rotte usate dagli ospiti (/registrazione, /api/alloggiati, /api/alloggiati/[id]).
import sql from './postgres';
import { randomUUID } from 'crypto';
import { Alloggiato } from './types';

let _ready = false;

export async function ensureAlloggiatiTable(): Promise<void> {
  if (_ready) return;
  await sql`
    CREATE TABLE IF NOT EXISTS alloggiati (
      id TEXT PRIMARY KEY,
      struttura_id TEXT,
      prenotazione_id TEXT,
      tipo TEXT NOT NULL,
      data_arrivo TEXT NOT NULL,
      permanenza INT NOT NULL DEFAULT 1,
      cognome TEXT NOT NULL DEFAULT '',
      nome TEXT NOT NULL DEFAULT '',
      sesso TEXT NOT NULL DEFAULT 'M',
      data_nascita TEXT NOT NULL DEFAULT '',
      comune_nascita TEXT NOT NULL DEFAULT '',
      provincia_nascita TEXT NOT NULL DEFAULT '',
      stato_nascita TEXT NOT NULL DEFAULT '',
      cittadinanza TEXT NOT NULL DEFAULT '',
      tipo_documento TEXT NOT NULL DEFAULT '',
      numero_documento TEXT NOT NULL DEFAULT '',
      luogo_rilascio TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )
  `;
  _ready = true;
}

export function rowToAlloggiato(row: Record<string, unknown>): Alloggiato {
  return {
    id: row.id as string,
    struttura_id: row.struttura_id as string | undefined,
    prenotazione_id: row.prenotazione_id as string | undefined,
    tipo: row.tipo as Alloggiato['tipo'],
    data_arrivo: row.data_arrivo as string,
    permanenza: Number(row.permanenza),
    cognome: row.cognome as string,
    nome: row.nome as string,
    sesso: row.sesso as 'M' | 'F',
    data_nascita: row.data_nascita as string,
    comune_nascita: row.comune_nascita as string,
    provincia_nascita: row.provincia_nascita as string,
    stato_nascita: row.stato_nascita as string,
    cittadinanza: row.cittadinanza as string,
    tipo_documento: row.tipo_documento as string,
    numero_documento: row.numero_documento as string,
    luogo_rilascio: row.luogo_rilascio as string,
    created_at: row.created_at as string,
  };
}

export async function leggiAlloggiati(strutturaId?: string, dataArrivo?: string): Promise<Alloggiato[]> {
  await ensureAlloggiatiTable();
  let rows: Record<string, unknown>[];
  if (strutturaId && dataArrivo) {
    rows = await sql`SELECT * FROM alloggiati WHERE struttura_id = ${strutturaId} AND data_arrivo = ${dataArrivo} ORDER BY created_at`;
  } else if (strutturaId) {
    rows = await sql`SELECT * FROM alloggiati WHERE struttura_id = ${strutturaId} ORDER BY data_arrivo DESC, created_at`;
  } else if (dataArrivo) {
    rows = await sql`SELECT * FROM alloggiati WHERE data_arrivo = ${dataArrivo} ORDER BY created_at`;
  } else {
    rows = await sql`SELECT * FROM alloggiati ORDER BY data_arrivo DESC, created_at`;
  }
  return rows.map(rowToAlloggiato);
}

export async function creaAlloggiato(data: Omit<Alloggiato, 'id' | 'created_at'>): Promise<Alloggiato> {
  await ensureAlloggiatiTable();
  const record: Alloggiato = {
    ...data,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  await sql`
    INSERT INTO alloggiati (
      id, struttura_id, prenotazione_id, tipo, data_arrivo, permanenza,
      cognome, nome, sesso, data_nascita, comune_nascita, provincia_nascita,
      stato_nascita, cittadinanza, tipo_documento, numero_documento, luogo_rilascio, created_at
    ) VALUES (
      ${record.id}, ${record.struttura_id ?? null}, ${record.prenotazione_id ?? null},
      ${record.tipo}, ${record.data_arrivo}, ${record.permanenza},
      ${record.cognome}, ${record.nome}, ${record.sesso}, ${record.data_nascita},
      ${record.comune_nascita}, ${record.provincia_nascita}, ${record.stato_nascita},
      ${record.cittadinanza}, ${record.tipo_documento}, ${record.numero_documento},
      ${record.luogo_rilascio}, ${record.created_at}
    )
  `;
  return record;
}

export async function aggiornaAlloggiato(id: string, data: Partial<Omit<Alloggiato, 'id' | 'created_at'>>): Promise<Alloggiato | null> {
  await ensureAlloggiatiTable();
  const rows = await sql`SELECT * FROM alloggiati WHERE id = ${id}`;
  if (rows.length === 0) return null;
  const existing = rowToAlloggiato(rows[0]);
  const updated: Alloggiato = { ...existing, ...data };
  await sql`
    UPDATE alloggiati SET
      struttura_id = ${updated.struttura_id ?? null},
      prenotazione_id = ${updated.prenotazione_id ?? null},
      tipo = ${updated.tipo},
      data_arrivo = ${updated.data_arrivo},
      permanenza = ${updated.permanenza},
      cognome = ${updated.cognome},
      nome = ${updated.nome},
      sesso = ${updated.sesso},
      data_nascita = ${updated.data_nascita},
      comune_nascita = ${updated.comune_nascita},
      provincia_nascita = ${updated.provincia_nascita},
      stato_nascita = ${updated.stato_nascita},
      cittadinanza = ${updated.cittadinanza},
      tipo_documento = ${updated.tipo_documento},
      numero_documento = ${updated.numero_documento},
      luogo_rilascio = ${updated.luogo_rilascio}
    WHERE id = ${id}
  `;
  return updated;
}

export async function eliminaAlloggiato(id: string): Promise<void> {
  await ensureAlloggiatiTable();
  await sql`DELETE FROM alloggiati WHERE id = ${id}`;
}
