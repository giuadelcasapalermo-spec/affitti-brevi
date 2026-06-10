import sql from './postgres';
import { randomUUID } from 'crypto';
import { Struttura, AlloggiatiCredentials, ContoCorrente, BookingChannelManagerConfig } from './types';

const DEFAULT_PREZZI: Record<number, number> = { 1: 60, 2: 60, 3: 65, 4: 65, 5: 70 };
const DEFAULT_CONTI: ContoCorrente[] = [{ id: 'contanti-default', tipo: 'contanti', nome: 'Contanti' }];

let _tableReady = false;
let _migrated = false;

async function ensureTable(): Promise<void> {
  if (_tableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS strutture (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      indirizzo TEXT NOT NULL DEFAULT '',
      num_camere INT NOT NULL DEFAULT 5,
      nomi_camere JSONB NOT NULL DEFAULT '{}',
      prezzi_camere JSONB NOT NULL DEFAULT '{}',
      colori_camere JSONB NOT NULL DEFAULT '{}',
      ical_urls JSONB NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    )
  `;
  await sql`ALTER TABLE strutture ADD COLUMN IF NOT EXISTS alloggiati_credentials JSONB DEFAULT NULL`;
  await sql`ALTER TABLE strutture ADD COLUMN IF NOT EXISTS conti_correnti JSONB DEFAULT '[]'`;
  await sql`ALTER TABLE strutture ADD COLUMN IF NOT EXISTS channel_manager_config JSONB DEFAULT NULL`;
  _tableReady = true;
}

function rowToStruttura(row: Record<string, unknown>): Struttura {
  const toNumericRecord = (v: unknown): Record<number, string> => {
    const obj = (v ?? {}) as Record<string, unknown>;
    const result: Record<number, string> = {};
    for (const [k, val] of Object.entries(obj)) result[Number(k)] = String(val);
    return result;
  };
  const toNumericNumberRecord = (v: unknown): Record<number, number> => {
    const obj = (v ?? {}) as Record<string, unknown>;
    const result: Record<number, number> = {};
    for (const [k, val] of Object.entries(obj)) result[Number(k)] = Number(val);
    return result;
  };
  const rawConti = Array.isArray(row.conti_correnti) ? row.conti_correnti : [];
  const conti: ContoCorrente[] = rawConti.length > 0 ? rawConti as ContoCorrente[] : DEFAULT_CONTI;
  return {
    id: row.id as string,
    nome: row.nome as string,
    indirizzo: row.indirizzo as string,
    num_camere: row.num_camere as number,
    nomi_camere: toNumericRecord(row.nomi_camere),
    prezzi_camere: toNumericNumberRecord(row.prezzi_camere),
    colori_camere: toNumericRecord(row.colori_camere),
    ical_urls: toNumericRecord(row.ical_urls),
    alloggiati_credentials: row.alloggiati_credentials as AlloggiatiCredentials | undefined,
    conti_correnti: conti,
    channel_manager_config: row.channel_manager_config as BookingChannelManagerConfig | undefined,
    created_at: row.created_at as string,
  };
}

export async function leggiStrutture(): Promise<Struttura[]> {
  await ensureTable();
  const rows = await sql`SELECT * FROM strutture ORDER BY created_at`;
  return rows.map(rowToStruttura);
}

export async function leggiStruttura(id: string): Promise<Struttura | null> {
  await ensureTable();
  const rows = await sql`SELECT * FROM strutture WHERE id = ${id}`;
  return rows.length > 0 ? rowToStruttura(rows[0]) : null;
}

export async function creaStruttura(nome: string, indirizzo: string, numCamere = 5): Promise<Struttura> {
  await ensureTable();
  const conti: ContoCorrente[] = [{ id: randomUUID(), tipo: 'contanti', nome: 'Contanti' }];
  const record: Struttura = {
    id: randomUUID(),
    nome,
    indirizzo,
    num_camere: numCamere,
    nomi_camere: {},
    prezzi_camere: Object.fromEntries(Array.from({ length: numCamere }, (_, i) => [i + 1, DEFAULT_PREZZI[i + 1] ?? 60])) as Record<number, number>,
    colori_camere: {},
    ical_urls: {},
    conti_correnti: conti,
    created_at: new Date().toISOString(),
  };
  await sql`
    INSERT INTO strutture (id, nome, indirizzo, num_camere, nomi_camere, prezzi_camere, colori_camere, ical_urls, conti_correnti, created_at)
    VALUES (${record.id}, ${record.nome}, ${record.indirizzo}, ${record.num_camere},
            ${JSON.stringify(record.nomi_camere)}, ${JSON.stringify(record.prezzi_camere)},
            ${JSON.stringify(record.colori_camere)}, ${JSON.stringify(record.ical_urls)},
            ${JSON.stringify(record.conti_correnti)}, ${record.created_at})
  `;
  return record;
}

export async function aggiornaStruttura(id: string, fields: Partial<Omit<Struttura, 'id' | 'created_at'>>): Promise<void> {
  if (fields.nome !== undefined)
    await sql`UPDATE strutture SET nome = ${fields.nome} WHERE id = ${id}`;
  if (fields.indirizzo !== undefined)
    await sql`UPDATE strutture SET indirizzo = ${fields.indirizzo} WHERE id = ${id}`;
  if (fields.num_camere !== undefined)
    await sql`UPDATE strutture SET num_camere = ${fields.num_camere} WHERE id = ${id}`;
  if (fields.nomi_camere !== undefined)
    await sql`UPDATE strutture SET nomi_camere = ${JSON.stringify(fields.nomi_camere)} WHERE id = ${id}`;
  if (fields.prezzi_camere !== undefined)
    await sql`UPDATE strutture SET prezzi_camere = ${JSON.stringify(fields.prezzi_camere)} WHERE id = ${id}`;
  if (fields.colori_camere !== undefined)
    await sql`UPDATE strutture SET colori_camere = ${JSON.stringify(fields.colori_camere)} WHERE id = ${id}`;
  if (fields.ical_urls !== undefined)
    await sql`UPDATE strutture SET ical_urls = ${JSON.stringify(fields.ical_urls)} WHERE id = ${id}`;
  if (fields.alloggiati_credentials !== undefined)
    await sql`UPDATE strutture SET alloggiati_credentials = ${JSON.stringify(fields.alloggiati_credentials)} WHERE id = ${id}`;
  if (fields.conti_correnti !== undefined)
    await sql`UPDATE strutture SET conti_correnti = ${JSON.stringify(fields.conti_correnti)} WHERE id = ${id}`;
  if (fields.channel_manager_config !== undefined)
    await sql`UPDATE strutture SET channel_manager_config = ${JSON.stringify(fields.channel_manager_config)} WHERE id = ${id}`;
}

export async function eliminaStruttura(id: string): Promise<void> {
  await sql`DELETE FROM strutture WHERE id = ${id}`;
}

export async function getOrCreateDefaultStruttura(): Promise<Struttura> {
  await ensureTable();
  const existing = await sql`SELECT * FROM strutture ORDER BY created_at LIMIT 1`;
  if (existing.length > 0) return rowToStruttura(existing[0]);

  // Migrate from legacy impostazioni
  const rows = await sql`SELECT tipo, chiave, valore FROM impostazioni`;
  const nomi: Record<number, string> = {};
  const prezzi: Record<number, number> = {};
  const colori: Record<number, string> = {};
  const ical: Record<number, string> = {};
  let numCamere = 5;

  for (const row of rows) {
    const cid = Number(row.chiave);
    if (row.tipo === 'ical' && !isNaN(cid)) ical[cid] = row.valore as string;
    else if (row.tipo === 'camera' && !isNaN(cid)) nomi[cid] = row.valore as string;
    else if (row.tipo === 'config' && row.chiave === 'num_camere') numCamere = Number(row.valore);
    else if (row.tipo === 'camera_price' && !isNaN(cid)) prezzi[cid] = Number(row.valore);
    else if (row.tipo === 'camera_color' && !isNaN(cid)) colori[cid] = row.valore as string;
  }
  for (let i = 1; i <= numCamere; i++) {
    if (prezzi[i] === undefined) prezzi[i] = DEFAULT_PREZZI[i] ?? 60;
  }

  const conti: ContoCorrente[] = [{ id: randomUUID(), tipo: 'contanti', nome: 'Contanti' }];
  const struttura: Struttura = {
    id: randomUUID(),
    nome: 'Struttura principale',
    indirizzo: '',
    num_camere: numCamere,
    nomi_camere: nomi,
    prezzi_camere: prezzi,
    colori_camere: colori,
    ical_urls: ical,
    conti_correnti: conti,
    created_at: new Date().toISOString(),
  };
  await sql`
    INSERT INTO strutture (id, nome, indirizzo, num_camere, nomi_camere, prezzi_camere, colori_camere, ical_urls, conti_correnti, created_at)
    VALUES (${struttura.id}, ${struttura.nome}, ${struttura.indirizzo}, ${struttura.num_camere},
            ${JSON.stringify(struttura.nomi_camere)}, ${JSON.stringify(struttura.prezzi_camere)},
            ${JSON.stringify(struttura.colori_camere)}, ${JSON.stringify(struttura.ical_urls)},
            ${JSON.stringify(struttura.conti_correnti)}, ${struttura.created_at})
  `;
  return struttura;
}

export async function migraStruttura(): Promise<string> {
  if (_migrated) return '';
  const s = await getOrCreateDefaultStruttura();
  await sql`ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS struttura_id TEXT`;
  await sql`ALTER TABLE prezzi_periodi ADD COLUMN IF NOT EXISTS struttura_id TEXT`;
  await sql`UPDATE prenotazioni SET struttura_id = ${s.id} WHERE struttura_id IS NULL`;
  await sql`UPDATE prezzi_periodi SET struttura_id = ${s.id} WHERE struttura_id IS NULL`;
  _migrated = true;
  return s.id;
}

export async function getStrutturaAttiva(strutturaId?: string): Promise<Struttura> {
  if (strutturaId) {
    const s = await leggiStruttura(strutturaId);
    if (s) return s;
  }
  return getOrCreateDefaultStruttura();
}
