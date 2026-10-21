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

const parole = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/[^a-z]+/).filter((w) => w.length >= 3);
function distanza(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}
/** Una parola del nome in prenotazione uguale (o quasi, refusi del foglio) a una degli ospiti */
const stessoOspite = (nome, ospiti) => parole(nome).some((a) => parole(ospiti).some((b) =>
  a === b || (a.length >= 5 && b.length >= 5 && distanza(a, b) <= 1)));

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
  const libere = (await sql`
    SELECT id, camera_id, ospite_nome, check_in, check_out, fonte FROM prenotazioni
    WHERE stato <> 'cancellata' AND struttura_id IS NOT DISTINCT FROM ${o.struttura_id}
      AND check_in = ${arrivo} AND check_out = ${partenza}`).filter((p) => !conDoc.has(p.id));
  // Stesse date non bastano (più camere arrivano lo stesso giorno): serve anche il nome
  const candidate = libere.filter((p) => stessoOspite(p.ospite_nome, o.ospiti));
  if (candidate.length !== 1) {
    const elenco = libere.length === 0 ? 'nessuna prenotazione libera con queste date'
      : `${candidate.length === 0 ? 'nessun nome corrispondente' : 'più nomi corrispondenti'} tra: ${libere.map((c) => `camera ${c.camera_id} ${c.ospite_nome}`).join(', ')}`;
    restano.push(`  ${arrivo}→${partenza} ${o.ospiti} — ${elenco}`);
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
  WHERE data::text < '2024-01-01' OR data::text > ${`${new Date().getFullYear() + 2}-12-31`} ORDER BY data`;
console.log(`\nUscite con data fuori periodo: ${vecchie.length}`);
vecchie.forEach((u) => console.log(`  ${u.data}  ${Number(u.importo).toFixed(2)} €  ${u.categoria}  ${u.descrizione}  (id ${u.id})`));

if (!applica && riagganciati) console.log('\nSimulazione: niente scritto. Rilancia con --applica per scrivere.');
