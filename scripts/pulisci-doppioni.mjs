/**
 * pulisci-doppioni.mjs — elimina i blocchi Booking (iCal) rimasti 'cancellata' accanto alla
 * prenotazione vera della stessa camera e con lo stesso arrivo. Prima sposta sulla prenotazione
 * vera anagrafiche, link di check-in, ricevuta dell'imposta, "istruzioni inviate" e numero ospiti,
 * poi ignora l'UID così l'allineamento non lo reimporta.
 *   node scripts/pulisci-doppioni.mjs            → mostra cosa farebbe (nessuna modifica)
 *   node scripts/pulisci-doppioni.mjs --applica  → esegue
 */
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local'), quiet: true });
const sql = neon(process.env.DATABASE_URL);
const applica = process.argv.includes('--applica');

const pren = await sql`SELECT id, struttura_id, camera_id, ospite_nome, check_in, check_out, stato, fonte, ical_uid FROM prenotazioni`;
const conta = async (q) => new Map((await q).map((r) => [r.id, r.n]));
const doc = await conta(sql`SELECT prenotazione_id id, COUNT(*)::int n FROM alloggiati WHERE prenotazione_id IS NOT NULL GROUP BY 1`);
const link = await conta(sql`SELECT prenotazione_id id, COUNT(*)::int n FROM link_alloggiati GROUP BY 1`);
const ric = await conta(sql`SELECT riferimento id, COUNT(*)::int n FROM ricevute WHERE serie = 'tassa' GROUP BY 1`);
const istr = new Set((await sql`SELECT chiave FROM impostazioni WHERE tipo = 'istruzioni_inviate'`).map((r) => r.chiave));

let fatti = 0, saltati = 0;
for (const d of pren.filter((p) => p.fonte === 'ical' && p.stato === 'cancellata')) {
  const gemelli = pren.filter((p) => p.id !== d.id && p.stato !== 'cancellata' && p.camera_id === d.camera_id
    && p.check_in === d.check_in && p.struttura_id === d.struttura_id);
  // Preferisce la prenotazione vera (foglio/manuale) a un altro blocco iCal
  const reali = gemelli.filter((p) => p.fonte !== 'ical');
  const g = reali.length === 1 ? reali[0] : reali.length === 0 && gemelli.length === 1 ? gemelli[0] : undefined;
  if (!g) continue;

  const descr = `cam${d.camera_id} ${d.ospite_nome} ${d.check_in}→${d.check_out}: doppione ${d.id.slice(0, 8)} → ${g.fonte} ${g.id.slice(0, 8)}`;
  if ((doc.get(d.id) && doc.get(g.id)) || (ric.get(d.id) && ric.get(g.id))) {
    console.log(`SALTATO ${descr} — anagrafiche o ricevute su entrambe, da sistemare a mano`);
    saltati++;
    continue;
  }
  const sposta = [
    doc.get(d.id) && `${doc.get(d.id)} anagrafiche`,
    link.get(d.id) && `${link.get(d.id)} link check-in`,
    ric.get(d.id) && 'ricevuta imposta',
    istr.has(d.id) && !istr.has(g.id) && 'istruzioni inviate',
  ].filter(Boolean);
  console.log(`${descr}${sposta.length ? ` (sposta: ${sposta.join(', ')})` : ''}`);
  fatti++;
  if (!applica) continue;

  await sql`UPDATE alloggiati SET prenotazione_id = ${g.id} WHERE prenotazione_id = ${d.id}`;
  await sql`UPDATE link_alloggiati SET prenotazione_id = ${g.id} WHERE prenotazione_id = ${d.id}`;
  await sql`UPDATE ricevute SET riferimento = ${g.id} WHERE serie = 'tassa' AND riferimento = ${d.id}`;
  if (istr.has(d.id) && !istr.has(g.id)) await sql`UPDATE impostazioni SET chiave = ${g.id} WHERE tipo = 'istruzioni_inviate' AND chiave = ${d.id}`;
  await sql`DELETE FROM impostazioni WHERE tipo = 'istruzioni_inviate' AND chiave = ${d.id}`;
  await sql`UPDATE prenotazioni SET num_ospiti = (SELECT num_ospiti FROM prenotazioni WHERE id = ${d.id}) WHERE id = ${g.id} AND num_ospiti IS NULL`;
  await sql`DELETE FROM prenotazioni WHERE id = ${d.id}`;
  // UID ignorato solo se nessun'altra prenotazione viva lo usa (le date si fissano al prossimo sync)
  if (d.ical_uid && !pren.some((p) => p.id !== d.id && p.ical_uid === d.ical_uid && p.stato !== 'cancellata')) {
    await sql`INSERT INTO impostazioni (tipo, chiave, valore) VALUES ('ical_ignora', ${d.ical_uid}, ${String(d.camera_id)})
      ON CONFLICT (tipo, chiave) DO NOTHING`;
  }
}
console.log(`\n${fatti} doppioni ${applica ? 'eliminati' : 'da eliminare'}, ${saltati} da sistemare a mano.`
  + (applica ? '' : '\nNessuna modifica: rilancia con --applica per eseguire.'));
