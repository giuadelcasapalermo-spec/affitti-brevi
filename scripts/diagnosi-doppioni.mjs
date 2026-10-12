/**
 * diagnosi-doppioni.mjs — SOLA LETTURA, non modifica nulla.
 * Elenca le prenotazioni attive sovrapposte sulla stessa camera (iCal/Booking vs foglio/manuale)
 * con i dati che servono a capire perché la riconciliazione non le ha tolte.
 *   node scripts/diagnosi-doppioni.mjs
 */
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });
const sql = neon(process.env.DATABASE_URL);

const oggi = new Date().toISOString().slice(0, 10);
const pren = await sql`
  SELECT id, struttura_id, camera_id, ospite_nome, check_in, check_out, stato, fonte, ical_uid, created_at, note
  FROM prenotazioni WHERE stato <> 'cancellata' AND check_out >= ${oggi} ORDER BY camera_id, check_in`;
const doc = new Map((await sql`SELECT prenotazione_id, COUNT(*)::int n FROM alloggiati WHERE prenotazione_id IS NOT NULL GROUP BY 1`).map(r => [r.prenotazione_id, r.n]));
let link = new Map();
try { link = new Map((await sql`SELECT prenotazione_id, COUNT(*)::int n FROM link_alloggiati GROUP BY 1`).map(r => [r.prenotazione_id, r.n])); } catch { /* tabella assente */ }
const ignorati = new Map((await sql`SELECT chiave, valore FROM impostazioni WHERE tipo = 'ical_ignora'`).map(r => [r.chiave, r.valore]));

const riga = p => `  [${p.fonte}] ${p.id.slice(0, 8)} ${p.ospite_nome} ${p.check_in}→${p.check_out} creata ${String(p.created_at).slice(0, 16)}`
  + ` doc=${doc.get(p.id) ?? 0} link=${link.get(p.id) ?? 0}${p.ical_uid ? ` uid=${p.ical_uid.slice(0, 12)}${ignorati.has(p.ical_uid) ? ` IGNORATO(${ignorati.get(p.ical_uid)})` : ''}` : ''}\n     note: ${p.note}`;

let n = 0;
for (const g of pren.filter(p => p.fonte === 'ical' || p.fonte === 'booking')) {
  const altre = pren.filter(p => p.id !== g.id && p.struttura_id === g.struttura_id && p.camera_id === g.camera_id
    && p.fonte !== 'ical' && p.fonte !== 'booking' && p.check_in < g.check_out && p.check_out > g.check_in);
  if (!altre.length) continue;
  n++;
  console.log(`\nCamera ${g.camera_id}:`);
  console.log(riga(g));
  altre.forEach(a => console.log(riga(a)));
}
console.log(`\n${n} blocchi iCal attivi sovrapposti a prenotazioni reali. UID ignorati totali: ${ignorati.size}`);

// Documenti e link di check-in rimasti senza prenotazione (doppioni BK eliminati a mano prima della correzione)
const orfaniDoc = await sql`
  SELECT a.prenotazione_id, a.data_arrivo, string_agg(a.cognome || ' ' || a.nome, ', ') ospiti
  FROM alloggiati a LEFT JOIN prenotazioni p ON p.id = a.prenotazione_id
  WHERE a.prenotazione_id IS NOT NULL AND p.id IS NULL GROUP BY 1, 2 ORDER BY 2`;
console.log(`\nAnagrafiche orfane: ${orfaniDoc.length}`);
orfaniDoc.forEach(o => console.log(`  ${o.data_arrivo} ${o.ospiti} (era ${o.prenotazione_id.slice(0, 8)})`));
try {
  const orfaniLink = await sql`
    SELECT l.nome_ospite, l.data_arrivo, l.prenotazione_id FROM link_alloggiati l
    LEFT JOIN prenotazioni p ON p.id = l.prenotazione_id WHERE p.id IS NULL AND l.data_arrivo >= ${oggi} ORDER BY 2`;
  console.log(`Link di check-in futuri orfani: ${orfaniLink.length}`);
  orfaniLink.forEach(o => console.log(`  ${o.data_arrivo} ${o.nome_ospite} (era ${o.prenotazione_id.slice(0, 8)})`));
} catch { /* tabella assente */ }
