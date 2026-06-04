import { Entrata } from './types';
import sql from './postgres';

let _colReady = false;
async function ensureCol(): Promise<void> {
  if (_colReady) return;
  await sql`ALTER TABLE entrate ADD COLUMN IF NOT EXISTS fonte_pagamento TEXT NOT NULL DEFAULT 'Contanti'`;
  _colReady = true;
}

export async function leggiEntrate(): Promise<Entrata[]> {
  await ensureCol();
  const rows = await sql`
    SELECT id, data, descrizione, categoria, importo, camera_id, note, fonte_pagamento, created_at
    FROM entrate
    ORDER BY data DESC
  `;
  return rows as unknown as Entrata[];
}

export async function scriviEntrate(entrate: Entrata[]): Promise<void> {
  await ensureCol();
  if (entrate.length === 0) {
    await sql`DELETE FROM entrate`;
    return;
  }

  const ids = entrate.map((e) => e.id);
  await sql`DELETE FROM entrate WHERE id != ALL(${ids})`;

  for (const e of entrate) {
    await sql`
      INSERT INTO entrate (id, data, descrizione, categoria, importo, camera_id, note, fonte_pagamento, created_at)
      VALUES (
        ${e.id}, ${e.data}, ${e.descrizione}, ${e.categoria}, ${e.importo},
        ${e.camera_id ?? null}, ${e.note}, ${e.fonte_pagamento ?? 'Contanti'}, ${e.created_at}
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
