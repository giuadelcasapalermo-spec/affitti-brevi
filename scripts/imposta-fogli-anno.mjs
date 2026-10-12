/**
 * imposta-fogli-anno.mjs — salva i fogli Google per anno (Impostazioni → Google Sheets → Fogli per anno).
 *   node scripts/imposta-fogli-anno.mjs 2025=<id o URL> 2026=<id o URL> ...
 * Aggiunge o aggiorna solo gli anni indicati; gli altri restano com'erano.
 */
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });
const sql = neon(process.env.DATABASE_URL);

const voci = process.argv.slice(2).map((a) => {
  const [anno, raw] = a.split('=');
  const id = raw?.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? raw?.trim();
  if (!/^\d{4}$/.test(anno) || !id) throw new Error(`Argomento non valido: ${a} (atteso ANNO=ID)`);
  return [anno, id];
});
if (!voci.length) throw new Error('Nessun foglio indicato');

for (const [anno, id] of voci) {
  await sql`
    INSERT INTO impostazioni (tipo, chiave, valore) VALUES ('sheet_anno', ${anno}, ${id})
    ON CONFLICT (tipo, chiave) DO UPDATE SET valore = EXCLUDED.valore
  `;
}
const righe = await sql`SELECT chiave, valore FROM impostazioni WHERE tipo = 'sheet_anno' ORDER BY chiave`;
console.log('Fogli per anno:');
righe.forEach((r) => console.log(`  ${r.chiave} → ${r.valore}`));
const [principale] = await sql`SELECT valore FROM impostazioni WHERE tipo = 'config' AND chiave = 'google_sheet_id'`;
console.log(`Foglio principale: ${principale?.valore || '(non impostato)'}`);
