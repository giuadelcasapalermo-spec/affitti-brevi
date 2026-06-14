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
  const ids = prenotazioni.map((p) => p.id);
  if (strutturaId) {
    await sql`DELETE FROM prenotazioni WHERE struttura_id = ${strutturaId} AND id != ALL(${ids})`;
  } else {
    await sql`DELETE FROM prenotazioni WHERE id != ALL(${ids})`;
  }
  await Promise.all(prenotazioni.map(p => sql`
    INSERT INTO prenotazioni (id, struttura_id, camera_id, ospite_nome, ospite_telefono, ospite_email,
      check_in, check_out, importo_totale, tassa_soggiorno, stato, note, created_at, fonte, ical_uid)
    VALUES (
      ${p.id}, ${p.struttura_id ?? strutturaId ?? null}, ${p.camera_id}, ${p.ospite_nome}, ${p.ospite_telefono}, ${p.ospite_email},
      ${p.check_in}, ${p.check_out}, ${p.importo_totale}, ${p.tassa_soggiorno ?? null},
      ${p.stato}, ${p.note}, ${p.created_at}, ${p.fonte}, ${p.ical_uid ?? null}
    )
    ON CONFLICT (id) DO UPDATE SET
      struttura_id = EXCLUDED.struttura_id,
      camera_id = EXCLUDED.camera_id,
      ospite_nome = EXCLUDED.ospite_nome,
      ospite_telefono = EXCLUDED.ospite_telefono,
      ospite_email = EXCLUDED.ospite_email,
      check_in = EXCLUDED.check_in,
      check_out = EXCLUDED.check_out,
      importo_totale = EXCLUDED.importo_totale,
      tassa_soggiorno = EXCLUDED.tassa_soggiorno,
      stato = EXCLUDED.stato,
      note = EXCLUDED.note,
      fonte = EXCLUDED.fonte,
      ical_uid = EXCLUDED.ical_uid
  `));
}
