import sql from './postgres';
import { randomUUID } from 'crypto';
import { Alloggiato } from './types';
import { nomePaeseACodice, nomePaeseACodiciCittadinanza, aggettivoCittadinanzaACodice, codiceStatoNascita } from './codici-alloggiati';
import { nomeACodiceComune, COMUNI } from './comuni-italiani';

let _ready = false;

async function ensureTable(): Promise<void> {
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

function rowToAlloggiato(row: Record<string, unknown>): Alloggiato {
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
  await ensureTable();
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
  await ensureTable();
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
  await ensureTable();
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
  await ensureTable();
  await sql`DELETE FROM alloggiati WHERE id = ${id}`;
}

function pad(str: string, len: number): string {
  return str.substring(0, len).padEnd(len, ' ');
}

function padLeft(num: number, len: number): string {
  return String(num).padStart(len, ' ');
}

function formatDataIT(dateStr: string): string {
  if (!dateStr) return '          ';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr.substring(0, 10);
}

// Converte il valore grezzo (nome paese, vecchio Z-code, o codice 9-cifre) nel codice corretto.
function codicePaeseSanitizzato(raw: string): string {
  const v = (raw ?? '').trim();
  if (!v) return '';
  if (/^\d{9}$/.test(v)) return v;   // già codice 9-cifre (es. 100000100)
  return nomePaeseACodice(v);         // gestisce Z-code legacy, nomi, varianti
}

// Mappa i codici tipo_documento a 2 char nei codici 5-char richiesti dal portale
const TIPO_DOC_MAP: Record<string, string> = {
  'CI': 'IDELE',   // Carta d'Identità Elettronica
  'PP': 'PASSE',   // Passaporto
  'PA': 'PATEG',   // Patente di guida
};

function tipoDocumentoSanitizzato(raw: string): string {
  const v = (raw ?? '').trim().toUpperCase();
  if (v.length === 5) return v;                      // già nel formato corretto
  return TIPO_DOC_MAP[v] ?? raw.substring(0, 5).padEnd(5, ' ');
}

export function generaFileAlloggiati(alloggiati: Alloggiato[]): string {
  const righe = alloggiati.map(a => {
    const tipo = pad(a.tipo, 2);
    const dataArrivo = formatDataIT(a.data_arrivo);
    const permanenza = padLeft(a.permanenza, 2);
    const cognome = pad(a.cognome.toUpperCase(), 50);
    const nome = pad(a.nome.toUpperCase(), 30);
    const sesso = a.sesso === 'F' ? '2' : '1';
    const dataNascita = formatDataIT(a.data_nascita);

    const statoNascitaCode = codicePaeseSanitizzato(a.stato_nascita);
    // Nato in Italia: stato = 100000100, comune = codice ISTAT, provincia = 2 char
    // Nato all'estero: stato = codice paese, comune blank, provincia blank
    const isBornInItaly = !statoNascitaCode || statoNascitaCode === '100000100';

    let comuneNascita: string;
    let provinciaNascita: string;
    let statoNascita: string;

    if (isBornInItaly) {
      statoNascita = pad('100000100', 9);
      const comuneNascitaClean = a.comune_nascita.trim().replace(/\s*\([A-Z]{1,3}\)\s*$/i, '').trim();
      const rawComune = /^\d{9}$/.test(a.comune_nascita.trim())
        ? a.comune_nascita.trim()
        : nomeACodiceComune(comuneNascitaClean) || nomeACodiceComune(a.comune_nascita) || '';
      comuneNascita = pad(rawComune, 9);
      const provRaw = (a.provincia_nascita?.trim() || COMUNI.find(c => c.codice === rawComune.trim())?.prov || '').toUpperCase();
      provinciaNascita = pad(provRaw, 2);
    } else {
      statoNascita = pad(statoNascitaCode, 9);
      comuneNascita = pad('', 9);
      provinciaNascita = pad('', 2);
    }

    // cittadinanza: gestisce codici 9-cifre, Z-code legacy, nomi e aggettivi
    const rawCitt = (a.cittadinanza ?? '').trim();
    const cittadinanzaCode = /^\d{9}$/.test(rawCitt) ? rawCitt
      : aggettivoCittadinanzaACodice(rawCitt) || codicePaeseSanitizzato(rawCitt);
    const cittadinanza = pad(cittadinanzaCode, 9);
    const tipoDocumento = tipoDocumentoSanitizzato(a.tipo_documento);
    const numeroDocumento = pad(a.numero_documento, 20);

    // Luogo rilascio: codice ISTAT comune (italiani) o codice paese (stranieri/nati all'estero)
    const luogoRilascioClean = (a.luogo_rilascio ?? '').trim().replace(/\s*\([A-Z]{1,3}\)\s*$/i, '').trim();
    const rawLuogoResolved = /^\d{9}$/.test((a.luogo_rilascio ?? '').trim())
      ? a.luogo_rilascio.trim()
      : nomeACodiceComune(luogoRilascioClean) || nomeACodiceComune(a.luogo_rilascio) || '';
    const luogoRilascio = pad(
      rawLuogoResolved || (isBornInItaly ? comuneNascita.trim() : statoNascitaCode),
      9
    );

    return `${tipo}${dataArrivo}${permanenza}${cognome}${nome}${sesso}${dataNascita}${comuneNascita}${provinciaNascita}${statoNascita}${cittadinanza}${tipoDocumento}${numeroDocumento}${luogoRilascio}`;
  });
  return righe.join('\r\n');
}
