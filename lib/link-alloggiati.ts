import sql from './postgres';
import { randomUUID } from 'crypto';

export interface LinkAlloggiati {
  token: string;
  prenotazione_id: string;
  struttura_id?: string;
  email_ospite: string;
  nome_ospite: string;
  data_arrivo: string;
  permanenza: number;
  usato: boolean;
  created_at: string;
}

let _ready = false;

async function ensureTable(): Promise<void> {
  if (_ready) return;
  await sql`
    CREATE TABLE IF NOT EXISTS link_alloggiati (
      token TEXT PRIMARY KEY,
      prenotazione_id TEXT NOT NULL,
      struttura_id TEXT,
      email_ospite TEXT NOT NULL,
      nome_ospite TEXT NOT NULL DEFAULT '',
      data_arrivo TEXT NOT NULL,
      permanenza INT NOT NULL DEFAULT 1,
      usato BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL
    )
  `;
  _ready = true;
}

export async function creaLink(data: {
  prenotazioneId: string;
  strutturaId?: string;
  emailOspite: string;
  nomeOspite: string;
  dataArrivo: string;
  permanenza: number;
}): Promise<string> {
  await ensureTable();
  const token = randomUUID();
  await sql`
    INSERT INTO link_alloggiati (token, prenotazione_id, struttura_id, email_ospite, nome_ospite, data_arrivo, permanenza, usato, created_at)
    VALUES (
      ${token},
      ${data.prenotazioneId},
      ${data.strutturaId ?? null},
      ${data.emailOspite},
      ${data.nomeOspite},
      ${data.dataArrivo},
      ${data.permanenza},
      FALSE,
      ${new Date().toISOString()}
    )
  `;
  return token;
}

export async function leggiLink(token: string): Promise<LinkAlloggiati | null> {
  await ensureTable();
  const rows = await sql`SELECT * FROM link_alloggiati WHERE token = ${token}`;
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    token: row.token as string,
    prenotazione_id: row.prenotazione_id as string,
    struttura_id: row.struttura_id as string | undefined,
    email_ospite: row.email_ospite as string,
    nome_ospite: row.nome_ospite as string,
    data_arrivo: row.data_arrivo as string,
    permanenza: Number(row.permanenza),
    usato: Boolean(row.usato),
    created_at: row.created_at as string,
  };
}

export async function marcaUsato(token: string): Promise<void> {
  await ensureTable();
  await sql`UPDATE link_alloggiati SET usato = TRUE WHERE token = ${token}`;
}

export async function leggiLinksPerPrenotazioni(prenotazioneIds: string[]): Promise<Record<string, LinkAlloggiati>> {
  if (prenotazioneIds.length === 0) return {};
  await ensureTable();
  const rows = await sql`
    SELECT DISTINCT ON (prenotazione_id) *
    FROM link_alloggiati
    WHERE prenotazione_id = ANY(${prenotazioneIds})
    ORDER BY prenotazione_id, created_at DESC
  `;
  const result: Record<string, LinkAlloggiati> = {};
  for (const row of rows) {
    const pid = row.prenotazione_id as string;
    result[pid] = {
      token: row.token as string,
      prenotazione_id: pid,
      struttura_id: row.struttura_id as string | undefined,
      email_ospite: row.email_ospite as string,
      nome_ospite: row.nome_ospite as string,
      data_arrivo: row.data_arrivo as string,
      permanenza: Number(row.permanenza),
      usato: Boolean(row.usato),
      created_at: row.created_at as string,
    };
  }
  return result;
}

/** Testo del messaggio con il link di registrazione (usato anche dal pulsante WhatsApp in Alloggiati) */
export function testoLinkRegistrazione(ospite: string, struttura: string, checkIn: string, url: string): string {
  const data = checkIn.split('-').reverse().join('/');
  return `Buongiorno ${ospite},\nLe scriviamo da ${struttura}.\nPer velocizzare il check-in del ${data} La invitiamo a registrare in anticipo i suoi dati d'identità cliccando qui:\n${url}\n\nPuò importare i dati inquadrando direttamente il documento con la fotocamera, senza bisogno di trascriverli.\nUna volta ricevuti i documenti, Le invieremo le istruzioni per il check-in.\n\n---\n\nGood morning ${ospite},\nWe are writing from ${struttura}.\nTo speed up your check-in on ${data}, please register your identity details in advance here:\n${url}\n\nYou can import your data by scanning your document with the camera — no need to type anything manually.\nOnce we receive your documents, we will send you the check-in instructions.`;
}
