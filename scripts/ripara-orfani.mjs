/**
 * ripara-orfani.mjs — anagrafiche alloggiati rimaste senza prenotazione (doppioni BK eliminati a
 * mano prima di 7fe13f3) e uscite con date impossibili.
 * Ogni gruppo di anagrafiche orfane (stessa prenotazione_id) si riaggancia alla prenotazione viva
 * della stessa struttura con check-in = arrivo e check-out = arrivo + permanenza, se è UNA sola e
 * non ha già documenti. Gli altri gruppi vengono solo elencati.
 *   node scripts/ripara-orfani.mjs [file .env]            (simulazione)
 *   node scripts/ripara-orfani.mjs [file .env] --applica  (scrive)
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

const isoData = (v) => {
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s.slice(0, 10);
};
const piuGiorni = (d, n) => {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

const orfani = await sql`
  SELECT a.prenotazione_id, a.struttura_id, a.data_arrivo, MAX(a.permanenza)::int AS permanenza,
         string_agg(a.cognome || ' ' || a.nome, ', ') AS ospiti
  FROM alloggiati a LEFT JOIN prenotazioni p ON p.id = a.prenotazione_id
  WHERE a.prenotazione_id IS NOT NULL AND p.id IS NULL
  GROUP BY 1, 2, 3 ORDER BY 3`;

const conDoc = new Set((await sql`SELECT DISTINCT prenotazione_id FROM alloggiati WHERE prenotazione_id IS NOT NULL`).map((r) => r.prenotazione_id));
let riagganciati = 0;
const restano = [];
for (const o of orfani) {
  const arrivo = isoData(o.data_arrivo);
  const partenza = piuGiorni(arrivo, Math.max(1, o.permanenza));
  const candidate = (await sql`
    SELECT id, camera_id, ospite_nome, check_in, check_out, fonte FROM prenotazioni
    WHERE stato <> 'cancellata' AND struttura_id IS NOT DISTINCT FROM ${o.struttura_id}
      AND check_in = ${arrivo} AND check_out = ${partenza}`).filter((p) => !conDoc.has(p.id));
  if (candidate.length !== 1) {
    restano.push(`  ${arrivo}→${partenza} ${o.ospiti} — ${candidate.length === 0 ? 'nessuna prenotazione libera' : `${candidate.length} possibili: ${candidate.map((c) => `camera ${c.camera_id} ${c.ospite_nome}`).join(', ')}`}`);
    continue;
  }
  const [p] = candidate;
  riagganciati++;
  conDoc.add(p.id);
  console.log(`${arrivo}→${partenza} ${o.ospiti} → camera ${p.camera_id} "${p.ospite_nome}" (${p.fonte}, ${p.id.slice(0, 8)})`);
  if (applica) {
    await sql`UPDATE alloggiati SET prenotazione_id = ${p.id} WHERE prenotazione_id = ${o.prenotazione_id}`;
    try { await sql`UPDATE link_alloggiati SET prenotazione_id = ${p.id} WHERE prenotazione_id = ${o.prenotazione_id}`; } catch { /* tabella assente */ }
  }
}
console.log(`\nAnagrafiche orfane: ${orfani.length} gruppi, ${riagganciati} ${applica ? 'riagganciati' : 'riagganciabili'}.`);
if (restano.length) console.log(`Da vedere a mano (${restano.length}):\n${restano.join('\n')}`);

const vecchie = await sql`
  SELECT id, data::text AS data, categoria, descrizione, importo FROM uscite
  WHERE data < '2024-01-01' OR data > (CURRENT_DATE + INTERVAL '2 years') ORDER BY data`;
console.log(`\nUscite con data fuori periodo: ${vecchie.length}`);
vecchie.forEach((u) => console.log(`  ${u.data}  ${Number(u.importo).toFixed(2)} €  ${u.categoria}  ${u.descrizione}  (id ${u.id})`));

if (!applica && riagganciati) console.log('\nSimulazione: niente scritto. Rilancia con --applica per scrivere.');
