import { Prenotazione } from './types';
import sql from './postgres';
import { migraStruttura } from './strutture';

export async function leggiPrenotazioni(strutturaId?: string): Promise<Prenotazione[]> {
  await migraStruttura();
  const rows = strutturaId
    ? await sql`SELECT id, struttura_id, camera_id, ospite_nome, ospite_telefono, ospite_email,
                       check_in, check_out, importo_totale, tassa_soggiorno,
                       stato, note, created_at, fonte, ical_uid
                FROM prenotazioni WHERE struttura_id = ${strutturaId} ORDER BY check_in DESC`
    : await sql`SELECT id, struttura_id, camera_id, ospite_nome, ospite_telefono, ospite_email,
                       check_in, check_out, importo_totale, tassa_soggiorno,
                       stato, note, created_at, fonte, ical_uid
                FROM prenotazioni ORDER BY check_in DESC`;
  return rows as unknown as Prenotazione[];
}

export async function scriviPrenotazioni(prenotazioni: Prenotazione[], strutturaId?: string): Promise<void> {
  await migraStruttura();
  if (prenotazioni.length === 0) {
    if (strutturaId) {
      await sql`DELETE FROM prenotazioni WHERE struttura_id = ${strutturaId}`;
    } else {
      await sql`DELETE FROM prenotazioni`;
    }
    return;
  }
  const ids       = prenotazioni.map(p => p.id);
  const strIds    = prenotazioni.map(p => p.struttura_id ?? strutturaId ?? null);
  const camIds    = prenotazioni.map(p => p.camera_id);
  const nomi      = prenotazioni.map(p => p.ospite_nome);
  const telefoni  = prenotazioni.map(p => p.ospite_telefono);
  const emails    = prenotazioni.map(p => p.ospite_email);
  const checkIns  = prenotazioni.map(p => p.check_in);
  const checkOuts = prenotazioni.map(p => p.check_out);
  const importi   = prenotazioni.map(p => p.importo_totale);
  const tasse     = prenotazioni.map(p => p.tassa_soggiorno ?? null);
  const stati     = prenotazioni.map(p => p.stato);
  const notes     = prenotazioni.map(p => p.note);
  const crats     = prenotazioni.map(p => p.created_at);
  const fonti     = prenotazioni.map(p => p.fonte);
  const icalUids  = prenotazioni.map(p => p.ical_uid ?? null);
  await Promise.all([
    strutturaId
      ? sql`DELETE FROM prenotazioni WHERE struttura_id = ${strutturaId} AND id != ALL(${ids})`
      : sql`DELETE FROM prenotazioni WHERE id != ALL(${ids})`,
    sql`
      INSERT INTO prenotazioni (id, struttura_id, camera_id, ospite_nome, ospite_telefono, ospite_email,
        check_in, check_out, importo_totale, tassa_soggiorno, stato, note, created_at, fonte, ical_uid)
      SELECT * FROM unnest(
        ${ids}::text[], ${strIds}::text[], ${camIds}::int[], ${nomi}::text[], ${telefoni}::text[],
        ${emails}::text[], ${checkIns}::text[], ${checkOuts}::text[], ${importi}::numeric[],
        ${tasse}::numeric[], ${stati}::text[], ${notes}::text[], ${crats}::text[],
        ${fonti}::text[], ${icalUids}::text[]
      ) AS t(id, struttura_id, camera_id, ospite_nome, ospite_telefono, ospite_email,
        check_in, check_out, importo_totale, tassa_soggiorno, stato, note, created_at, fonte, ical_uid)
      ON CONFLICT (id) DO UPDATE SET
        struttura_id = EXCLUDED.struttura_id, camera_id = EXCLUDED.camera_id,
        ospite_nome = EXCLUDED.ospite_nome, ospite_telefono = EXCLUDED.ospite_telefono,
        ospite_email = EXCLUDED.ospite_email, check_in = EXCLUDED.check_in,
        check_out = EXCLUDED.check_out, importo_totale = EXCLUDED.importo_totale,
        tassa_soggiorno = EXCLUDED.tassa_soggiorno, stato = EXCLUDED.stato,
        note = EXCLUDED.note, fonte = EXCLUDED.fonte, ical_uid = EXCLUDED.ical_uid
    `,
  ]);
}
