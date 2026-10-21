/**
 * ripara-uid-booking.mjs — prenotazioni Booking cancellate per un cambio di UID.
 * Booking ripubblica a volte la stessa prenotazione con un UID nuovo: il sync cancellava la
 * prenotazione completata (nome, documenti) e creava un blocco "Ospite Booking.com" con le stesse date.
 * Per ogni blocco anonimo vivo con una prenotazione iCal cancellata delle stesse date (con nome o documenti):
 *   - la cancellata torna 'confermata' e prende l'UID del blocco;
 *   - documenti, link di check-in e ricevuta del blocco passano a lei;
 *   - il blocco e gli altri anonimi cancellati delle stesse date senza collegamenti vengono eliminati.
 *   node scripts/ripara-uid-booking.mjs [file .env]            (simulazione)
 *   node scripts/ripara-uid-booking.mjs [file .env] --applica  (scrive)
 */
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const applica = args.includes('--applica');
const envFile = args.find((a) => !a.startsWith('--')) ?? path.join(__dirname, '../.env.local');
dotenv.config({ path: envFile, quiet: true });
const sql = neon(process.env.DATABASE_URL);
const GENERICO = 'Ospite Booking.com';

const oggi = new Date().toISOString().slice(0, 10);
const righe = await sql`
  SELECT id, struttura_id, camera_id, ospite_nome, check_in, check_out, stato, ical_uid
  FROM prenotazioni WHERE fonte = 'ical' AND check_out >= ${oggi} ORDER BY camera_id, check_in`;

async function ids(query) {
  try { return new Set((await query).map((r) => r.id)); } catch { return new Set(); }
}
const tutti = righe.map((r) => r.id);
const doc = await ids(sql`SELECT DISTINCT prenotazione_id AS id FROM alloggiati WHERE prenotazione_id = ANY(${tutti})`);
const link = await ids(sql`SELECT DISTINCT prenotazione_id AS id FROM link_alloggiati WHERE prenotazione_id = ANY(${tutti})`);
const ric = await ids(sql`SELECT DISTINCT riferimento AS id FROM ricevute WHERE serie = 'tassa' AND riferimento = ANY(${tutti})`);
const collegata = (id) => doc.has(id) || link.has(id) || ric.has(id);

const gruppi = new Map();
for (const r of righe) {
  const k = `${r.struttura_id}|${r.camera_id}|${r.check_in}|${r.check_out}`;
  gruppi.set(k, [...(gruppi.get(k) ?? []), r]);
}

let n = 0;
for (const g of gruppi.values()) {
  const blocco = g.find((r) => r.stato !== 'cancellata' && r.ospite_nome === GENERICO);
  const recuperabili = g.filter((r) => r.stato === 'cancellata' && (r.ospite_nome !== GENERICO || collegata(r.id)));
  if (!blocco || recuperabili.length === 0) continue;
  const buona = recuperabili.sort((a, b) => Number(collegata(b.id)) - Number(collegata(a.id)))[0];
  const scarti = g.filter((r) => r.id !== buona.id && r.ospite_nome === GENERICO && (r.id === blocco.id || (r.stato === 'cancellata' && !collegata(r.id))));
  n++;
  console.log(`camera ${blocco.camera_id} ${blocco.check_in}→${blocco.check_out}: riattivo "${buona.ospite_nome}" (${buona.id.slice(0, 8)}, documenti ${doc.has(buona.id) ? 'sì' : 'no'}) con UID ${blocco.ical_uid.slice(0, 12)}; elimino ${scarti.map((s) => `${s.id.slice(0, 8)} (${s.stato})`).join(', ')}`);
  if (!applica) continue;
  await sql`UPDATE prenotazioni SET stato = 'confermata', ical_uid = ${blocco.ical_uid} WHERE id = ${buona.id}`;
  for (const s of scarti) {
    await sql`UPDATE alloggiati SET prenotazione_id = ${buona.id} WHERE prenotazione_id = ${s.id}`;
    try { await sql`UPDATE link_alloggiati SET prenotazione_id = ${buona.id} WHERE prenotazione_id = ${s.id}`; } catch { /* tabella assente */ }
    try { await sql`UPDATE ricevute SET riferimento = ${buona.id} WHERE serie = 'tassa' AND riferimento = ${s.id}`; } catch { /* tabella assente */ }
    await sql`DELETE FROM prenotazioni WHERE id = ${s.id}`;
  }
}
console.log(n === 0 ? 'Niente da riparare.' : applica ? `\nRiparate ${n} prenotazioni.` : `\n${n} da riparare. Rilancia con --applica per scrivere.`);
