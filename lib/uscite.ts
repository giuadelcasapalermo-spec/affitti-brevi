import { Uscita } from './types';
import sql from './postgres';

let _colReady = false;
async function ensureCol(): Promise<void> {
  if (_colReady) return;
  await sql`ALTER TABLE uscite ADD COLUMN IF NOT EXISTS fonte_pagamento TEXT NOT NULL DEFAULT 'Contanti'`;
  _colReady = true;
}

export async function leggiUscite(): Promise<Uscita[]> {
  await ensureCol();
  const rows = await sql`
    SELECT id, data, descrizione, categoria, importo, camera_id, note, fonte_pagamento, created_at
    FROM uscite
    ORDER BY data DESC
  `;
  return rows as unknown as Uscita[];
}

export async function scriviUscite(uscite: Uscita[]): Promise<void> {
  await ensureCol();
  if (uscite.length === 0) {
    await sql`DELETE FROM uscite`;
    return;
  }
  const ids = uscite.map((u) => u.id);
  await sql`DELETE FROM uscite WHERE id != ALL(${ids})`;
  await Promise.all(uscite.map(u => sql`
    INSERT INTO uscite (id, data, descrizione, categoria, importo, camera_id, note, fonte_pagamento, created_at)
    VALUES (
      ${u.id}, ${u.data}, ${u.descrizione}, ${u.categoria}, ${u.importo},
      ${u.camera_id ?? null}, ${u.note}, ${u.fonte_pagamento ?? 'Contanti'}, ${u.created_at}
    )
    ON CONFLICT (id) DO UPDATE SET
      data = EXCLUDED.data,
      descrizione = EXCLUDED.descrizione,
      categoria = EXCLUDED.categoria,
      importo = EXCLUDED.importo,
      camera_id = EXCLUDED.camera_id,
      note = EXCLUDED.note,
      fonte_pagamento = EXCLUDED.fonte_pagamento
  `));
}

export async function aggiungiUscita(u: Uscita): Promise<void> {
  await ensureCol();
  await sql`
    INSERT INTO uscite (id, data, descrizione, categoria, importo, camera_id, note, fonte_pagamento, created_at)
    VALUES (${u.id}, ${u.data}, ${u.descrizione}, ${u.categoria}, ${u.importo},
            ${u.camera_id ?? null}, ${u.note}, ${u.fonte_pagamento ?? 'Contanti'}, ${u.created_at})
  `;
}

export async function aggiornaUscita(id: string, fields: Partial<Uscita>): Promise<Uscita | null> {
  await ensureCol();
  const rows = await sql`
    SELECT id, data, descrizione, categoria, importo, camera_id, note, fonte_pagamento, created_at
    FROM uscite WHERE id = ${id}
  `;
  if (rows.length === 0) return null;
  const current = rows[0] as unknown as Uscita;
  const merged: Uscita = { ...current, ...fields, importo: Number(fields.importo ?? current.importo) };
  await sql`
    UPDATE uscite SET
      data = ${merged.data},
      descrizione = ${merged.descrizione},
      categoria = ${merged.categoria},
      importo = ${merged.importo},
      camera_id = ${merged.camera_id ?? null},
      note = ${merged.note},
      fonte_pagamento = ${merged.fonte_pagamento ?? 'Contanti'}
    WHERE id = ${id}
  `;
  return merged;
}

export async function eliminaUscita(id: string): Promise<boolean> {
  const rows = await sql`SELECT id FROM uscite WHERE id = ${id}`;
  if (rows.length === 0) return false;
  await sql`DELETE FROM uscite WHERE id = ${id}`;
  return true;
}
