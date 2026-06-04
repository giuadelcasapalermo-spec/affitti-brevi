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

  for (const u of uscite) {
    await sql`
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
    `;
  }
}
