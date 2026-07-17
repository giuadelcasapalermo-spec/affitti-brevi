/**
 * pulisci-duplicati-ical.mjs
 *
 * 1. Elimina i blocchi di disponibilità Booking.com ("Ospite Booking.com") accumulati prima
 *    del fix che ne evita l'importazione — sono placeholder, mai collegati a un documento
 *    cliente, quindi sempre sicuri da eliminare.
 * 2. Trova prenotazioni iCal duplicate causate dal cambio di ical_uid da parte di
 *    Booking.com (stessa struttura+camera+check_in+check_out, più righe con fonte='ical').
 *    Per ogni gruppo tiene la riga "giusta" e propone di eliminare le altre:
 *      a. se una riga del gruppo ha un documento cliente collegato (alloggiati.prenotazione_id),
 *         quella vince sempre (per non perdere il collegamento all'anagrafica);
 *      b. altrimenti vince la riga NON cancellata, o la più recente (created_at) a parità.
 *    Le righe scartate che hanno a loro volta un documento collegato vengono segnalate e MAI
 *    eliminate in automatico: vanno risolte a mano (richiede scegliere quale documento tenere).
 *
 * Uso:
 *   node scripts/pulisci-duplicati-ical.mjs           → dry-run, stampa solo il report
 *   node scripts/pulisci-duplicati-ical.mjs --applica → cancella davvero le righe scartate sicure
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const sql = neon(process.env.DATABASE_URL);
const APPLICA = process.argv.includes('--applica');

async function main() {
  const prenotazioni = await sql`
    SELECT id, struttura_id, camera_id, ospite_nome, check_in, check_out, stato, created_at, ical_uid
    FROM prenotazioni WHERE fonte = 'ical' ORDER BY check_in
  `;
  const alloggiati = await sql`SELECT prenotazione_id FROM alloggiati WHERE prenotazione_id IS NOT NULL`;
  const conDocumento = new Set(alloggiati.map(a => a.prenotazione_id));

  const blocchi = prenotazioni.filter(p => p.ospite_nome === 'Ospite Booking.com');
  const blocchiConDoc = blocchi.filter(p => conDocumento.has(p.id));
  const blocchiDaCancellare = blocchi.filter(p => !conDocumento.has(p.id)).map(p => p.id);

  console.log(`Blocchi "Ospite Booking.com" trovati: ${blocchi.length} (${blocchiDaCancellare.length} da eliminare, ${blocchiConDoc.length} con documento — non toccati)`);

  const prenotazioniReali = prenotazioni.filter(p => p.ospite_nome !== 'Ospite Booking.com');

  const gruppi = new Map();
  for (const p of prenotazioniReali) {
    const chiave = `${p.struttura_id}|${p.camera_id}|${p.check_in}|${p.check_out}`;
    if (!gruppi.has(chiave)) gruppi.set(chiave, []);
    gruppi.get(chiave).push(p);
  }

  const daCancellare = [];
  const daRisolvereAMano = [];
  let gruppiDuplicati = 0;

  for (const [chiave, righe] of gruppi) {
    if (righe.length < 2) continue;
    gruppiDuplicati++;

    const conDoc = righe.filter(p => conDocumento.has(p.id));
    let tenuta;
    if (conDoc.length === 1) {
      tenuta = conDoc[0];
    } else if (conDoc.length > 1) {
      // più righe dello stesso gruppo hanno un documento collegato: serve una scelta umana
      daRisolvereAMano.push({ chiave, righe, motivo: `${conDoc.length} righe hanno documenti cliente collegati` });
      continue;
    } else {
      const nonCancellate = righe.filter(p => p.stato !== 'cancellata');
      const pool = nonCancellate.length > 0 ? nonCancellate : righe;
      tenuta = pool.reduce((a, b) => (a.created_at > b.created_at ? a : b));
    }

    const scartate = righe.filter(p => p.id !== tenuta.id);
    const scartateConDoc = scartate.filter(p => conDocumento.has(p.id));
    if (scartateConDoc.length > 0) {
      daRisolvereAMano.push({ chiave, righe, motivo: 'una riga scartata ha comunque un documento collegato' });
      continue;
    }

    console.log(`\n[${chiave}]`);
    console.log(`  tieni:      ${tenuta.id}  ${tenuta.stato}  ${tenuta.ospite_nome}  uid=${tenuta.ical_uid}`);
    for (const s of scartate) {
      console.log(`  scarta:     ${s.id}  ${s.stato}  ${s.ospite_nome}  uid=${s.ical_uid}`);
      daCancellare.push(s.id);
    }
  }

  daCancellare.push(...blocchiDaCancellare);

  console.log('\n═══════════════════════════════════════');
  console.log(`Blocchi "Ospite Booking.com" da eliminare: ${blocchiDaCancellare.length}`);
  console.log(`Gruppi duplicati trovati       : ${gruppiDuplicati}`);
  console.log(`Righe da cancellare (totale)    : ${daCancellare.length}`);
  console.log(`Gruppi da risolvere a mano      : ${daRisolvereAMano.length}`);
  console.log('═══════════════════════════════════════');

  if (blocchiConDoc.length > 0) {
    console.log('\n⚠ Blocchi "Ospite Booking.com" con documento collegato (anomalo, NON toccati):');
    for (const p of blocchiConDoc) {
      console.log(`      ${p.id}  ${p.stato}  ${p.check_in} → ${p.check_out}  uid=${p.ical_uid}`);
    }
  }

  if (daRisolvereAMano.length > 0) {
    console.log('\n⚠ Gruppi con conflitto sui documenti cliente (NON toccati):');
    for (const g of daRisolvereAMano) {
      console.log(`  [${g.chiave}] — ${g.motivo}`);
      for (const p of g.righe) {
        console.log(`      ${p.id}  ${p.stato}  ${p.ospite_nome}  uid=${p.ical_uid}  doc=${conDocumento.has(p.id)}`);
      }
    }
  }

  if (!APPLICA) {
    console.log(daCancellare.length > 0
      ? '\nDry-run: nessuna riga cancellata. Rilancia con --applica per eseguire la cancellazione.'
      : '\nDry-run: nessuna riga da cancellare.');
    return;
  }

  if (daCancellare.length === 0) {
    console.log('\nNessuna riga da cancellare.');
    return;
  }

  await sql`DELETE FROM prenotazioni WHERE id = ANY(${daCancellare})`;
  console.log(`\n✓ Cancellate ${daCancellare.length} righe duplicate.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
