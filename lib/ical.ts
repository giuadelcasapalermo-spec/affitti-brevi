import { format } from 'date-fns';
import { Prenotazione, Impostazioni } from './types';
import { leggiPrenotazioni, scriviPrenotazioni } from './db';
import sql from './postgres';
import { randomUUID } from 'crypto';

const DEFAULT_PREZZI: Record<number, number> = { 1: 60, 2: 60, 3: 65, 4: 65, 5: 70 };

export async function leggiImpostazioni(): Promise<Impostazioni> {
  const rows = await sql`SELECT tipo, chiave, valore FROM impostazioni`;
  const imp: Impostazioni = { ical_urls: {}, nomi_camere: {}, prezzi_camere: {}, colori_camere: {}, num_camere: 5 };
  for (const row of rows) {
    const id = Number(row.chiave);
    if (row.tipo === 'ical' && !isNaN(id)) imp.ical_urls[id] = row.valore as string;
    else if (row.tipo === 'camera' && !isNaN(id)) imp.nomi_camere[id] = row.valore as string;
    else if (row.tipo === 'sync' && row.chiave === 'ultimo_sync') imp.ultimo_sync = row.valore as string;
    else if (row.tipo === 'config' && row.chiave === 'google_sheets_abilitato') imp.google_sheets_abilitato = row.valore === 'true';
    else if (row.tipo === 'config' && row.chiave === 'google_sheet_id') imp.google_sheet_id = row.valore as string;
    else if (row.tipo === 'config' && row.chiave === 'nome_app') imp.nome_app = row.valore as string;
    else if (row.tipo === 'config' && row.chiave === 'logo_url') imp.logo_url = row.valore as string;
    else if (row.tipo === 'config' && row.chiave === 'num_camere') imp.num_camere = Number(row.valore);
    else if (row.tipo === 'camera_price' && !isNaN(id)) imp.prezzi_camere[id] = Number(row.valore);
    else if (row.tipo === 'camera_color' && !isNaN(id)) imp.colori_camere[id] = row.valore as string;
  }
  // Se num_camere non ancora in DB, derivalo dai nomi_camere configurati
  const maxId = Math.max(0, ...Object.keys(imp.nomi_camere).map(Number));
  if (!rows.some(r => r.tipo === 'config' && r.chiave === 'num_camere')) {
    imp.num_camere = maxId > 0 ? maxId : 5;
  }
  // Fallback prezzi da default se non in DB
  for (let i = 1; i <= imp.num_camere; i++) {
    if (imp.prezzi_camere[i] === undefined) imp.prezzi_camere[i] = DEFAULT_PREZZI[i] ?? 60;
  }
  return imp;
}

export async function scriviImpostazioni(imp: Impostazioni): Promise<void> {
  for (const [id, url] of Object.entries(imp.ical_urls ?? {})) {
    await sql`
      INSERT INTO impostazioni (tipo, chiave, valore) VALUES ('ical', ${id}, ${url})
      ON CONFLICT (tipo, chiave) DO UPDATE SET valore = EXCLUDED.valore
    `;
  }
  for (const [id, nome] of Object.entries(imp.nomi_camere ?? {})) {
    await sql`
      INSERT INTO impostazioni (tipo, chiave, valore) VALUES ('camera', ${id}, ${nome})
      ON CONFLICT (tipo, chiave) DO UPDATE SET valore = EXCLUDED.valore
    `;
  }
  if (imp.ultimo_sync) {
    await sql`
      INSERT INTO impostazioni (tipo, chiave, valore) VALUES ('sync', 'ultimo_sync', ${imp.ultimo_sync})
      ON CONFLICT (tipo, chiave) DO UPDATE SET valore = EXCLUDED.valore
    `;
  }
  if (imp.google_sheets_abilitato !== undefined) {
    await sql`
      INSERT INTO impostazioni (tipo, chiave, valore) VALUES ('config', 'google_sheets_abilitato', ${String(imp.google_sheets_abilitato)})
      ON CONFLICT (tipo, chiave) DO UPDATE SET valore = EXCLUDED.valore
    `;
  }
  if (imp.google_sheet_id !== undefined) {
    await sql`
      INSERT INTO impostazioni (tipo, chiave, valore) VALUES ('config', 'google_sheet_id', ${imp.google_sheet_id})
      ON CONFLICT (tipo, chiave) DO UPDATE SET valore = EXCLUDED.valore
    `;
  }
  if (imp.nome_app !== undefined) {
    await sql`
      INSERT INTO impostazioni (tipo, chiave, valore) VALUES ('config', 'nome_app', ${imp.nome_app})
      ON CONFLICT (tipo, chiave) DO UPDATE SET valore = EXCLUDED.valore
    `;
  }
  if (imp.logo_url !== undefined) {
    await sql`
      INSERT INTO impostazioni (tipo, chiave, valore) VALUES ('config', 'logo_url', ${imp.logo_url})
      ON CONFLICT (tipo, chiave) DO UPDATE SET valore = EXCLUDED.valore
    `;
  }
  if (imp.num_camere !== undefined) {
    await sql`
      INSERT INTO impostazioni (tipo, chiave, valore) VALUES ('config', 'num_camere', ${String(imp.num_camere)})
      ON CONFLICT (tipo, chiave) DO UPDATE SET valore = EXCLUDED.valore
    `;
  }
  for (const [id, prezzo] of Object.entries(imp.prezzi_camere ?? {})) {
    await sql`
      INSERT INTO impostazioni (tipo, chiave, valore) VALUES ('camera_price', ${id}, ${String(prezzo)})
      ON CONFLICT (tipo, chiave) DO UPDATE SET valore = EXCLUDED.valore
    `;
  }
  for (const [id, colore] of Object.entries(imp.colori_camere ?? {})) {
    await sql`
      INSERT INTO impostazioni (tipo, chiave, valore) VALUES ('camera_color', ${id}, ${colore})
      ON CONFLICT (tipo, chiave) DO UPDATE SET valore = EXCLUDED.valore
    `;
  }
}

interface ICalEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
}

function parseIcalDate(val: string): Date {
  // Gestisce formati: 20240415, 20240415T120000Z, 20240415T120000
  const clean = val.replace(/[TZ]/g, '');
  const y = parseInt(clean.slice(0, 4));
  const mo = parseInt(clean.slice(4, 6)) - 1;
  const d = parseInt(clean.slice(6, 8));
  const h = clean.length >= 10 ? parseInt(clean.slice(8, 10)) : 0;
  const mi = clean.length >= 12 ? parseInt(clean.slice(10, 12)) : 0;
  return new Date(y, mo, d, h, mi);
}

function parseIcal(text: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  const lines = text
    .replace(/\r\n /g, '') // unfold continuation lines
    .replace(/\r\n\t/g, '')
    .split(/\r?\n/);

  let inEvent = false;
  let uid = '';
  let start: Date | null = null;
  let end: Date | null = null;
  let summary = '';

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      uid = '';
      start = null;
      end = null;
      summary = '';
      continue;
    }
    if (line === 'END:VEVENT') {
      inEvent = false;
      if (uid && start && end) {
        events.push({ uid, start, end, summary });
      }
      continue;
    }
    if (!inEvent) continue;

    if (line.startsWith('UID:')) {
      uid = line.slice(4).trim();
    } else if (line.startsWith('DTSTART') ) {
      const val = line.split(':').slice(1).join(':').trim();
      start = parseIcalDate(val);
    } else if (line.startsWith('DTEND')) {
      const val = line.split(':').slice(1).join(':').trim();
      end = parseIcalDate(val);
    } else if (line.startsWith('SUMMARY:')) {
      summary = line.slice(8).trim();
    }
  }

  return events;
}

export interface SyncResult {
  camera_id: number;
  aggiunte: number;
  rimosse: number;
  errore?: string;
}

export async function sincronizzaCalendario(
  cameraId: number,
  url: string,
  strutturaId: string
): Promise<SyncResult> {
  let testo: string;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CalendarBot/1.0; +https://affitti-brevi.vercel.app)',
        'Accept': 'text/calendar, text/plain, */*',
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${body ? ': ' + body.slice(0, 200) : ''}`);
    }
    testo = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
    return { camera_id: cameraId, aggiunte: 0, rimosse: 0, errore: msg };
  }

  const eventiRemoti = parseIcal(testo);
  const prenotazioni = await leggiPrenotazioni(strutturaId);
  const esistentiIcal = prenotazioni.filter(
    (p) => p.camera_id === cameraId && p.fonte === 'ical'
  );

  const daAggiungere: Prenotazione[] = [];

  for (const ev of eventiRemoti) {
    const giaPresente = esistentiIcal.find((p) => p.ical_uid === ev.uid);
    if (giaPresente) continue;

    const summaryLower = ev.summary.toLowerCase();
    const ospiteNome =
      ev.summary &&
      !summaryLower.includes('closed') &&
      !summaryLower.includes('blocked') &&
      !summaryLower.includes('not available')
        ? ev.summary
        : 'Ospite Booking.com';

    daAggiungere.push({
      id: randomUUID(),
      struttura_id: strutturaId,
      camera_id: cameraId,
      ospite_nome: ospiteNome,
      ospite_telefono: '',
      ospite_email: '',
      check_in: format(ev.start, 'yyyy-MM-dd'),
      check_out: format(ev.end, 'yyyy-MM-dd'),
      importo_totale: 0,
      stato: 'confermata',
      note: 'Importata da Booking.com (iCal)',
      created_at: new Date().toISOString(),
      fonte: 'ical',
      ical_uid: ev.uid,
    });
  }

  const aggiornate = [...prenotazioni, ...daAggiungere];
  await scriviPrenotazioni(aggiornate, strutturaId);

  return {
    camera_id: cameraId,
    aggiunte: daAggiungere.length,
    rimosse: 0,
  };
}

export async function sincronizzaTutti(icalUrls: Record<number, string>, strutturaId: string): Promise<SyncResult[]> {
  const risultati: SyncResult[] = [];

  for (const [idStr, url] of Object.entries(icalUrls)) {
    if (!url?.trim()) continue;
    const res = await sincronizzaCalendario(Number(idStr), url, strutturaId);
    risultati.push(res);
  }

  try {
    const imp = await leggiImpostazioni();
    imp.ultimo_sync = new Date().toISOString();
    await scriviImpostazioni(imp);
  } catch {
    // Ignora errori di scrittura timestamp
  }

  return risultati;
}
