import sql from './postgres';
import { CAPI_BIANCHERIA, type BiancheriaStanza, type CapoBiancheria } from './types';

let _tableReady = false;
async function ensureTable(): Promise<void> {
  if (_tableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS biancheria (
      data TEXT NOT NULL,
      camera_id INT NOT NULL,
      lenz_sing INT NOT NULL DEFAULT 0,
      lenz_matr INT NOT NULL DEFAULT 0,
      federe INT NOT NULL DEFAULT 0,
      telo_doccia INT NOT NULL DEFAULT 0,
      telo_viso INT NOT NULL DEFAULT 0,
      telo_ospite INT NOT NULL DEFAULT 0,
      tappetini INT NOT NULL DEFAULT 0,
      copriletto INT NOT NULL DEFAULT 0,
      piumone INT NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (data, camera_id)
    )
  `;
  await sql`ALTER TABLE biancheria ADD COLUMN IF NOT EXISTS copriletto INT NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE biancheria ADD COLUMN IF NOT EXISTS piumone INT NOT NULL DEFAULT 0`;
  _tableReady = true;
}

export async function leggiBiancheria(dal: string, al: string): Promise<BiancheriaStanza[]> {
  await ensureTable();
  const rows = await sql`
    SELECT data, camera_id, lenz_sing, lenz_matr, federe, telo_doccia, telo_viso, telo_ospite, tappetini, copriletto, piumone, updated_at
    FROM biancheria
    WHERE data >= ${dal} AND data <= ${al}
    ORDER BY data, camera_id
  `;
  return rows as unknown as BiancheriaStanza[];
}

// Sostituisce le righe di un giorno: le stanze non presenti (o tutte a zero) vengono rimosse
export async function scriviBiancheriaGiorno(data: string, righe: BiancheriaStanza[]): Promise<void> {
  await ensureTable();
  const now = new Date().toISOString();
  const valide = righe.filter((r) => CAPI_BIANCHERIA.some((c) => r[c.key] > 0));
  const camere = valide.map((r) => r.camera_id);
  await sql`DELETE FROM biancheria WHERE data = ${data} AND camera_id != ALL(${camere})`;
  await Promise.all(valide.map((r) => sql`
    INSERT INTO biancheria (data, camera_id, lenz_sing, lenz_matr, federe, telo_doccia, telo_viso, telo_ospite, tappetini, copriletto, piumone, updated_at)
    VALUES (${data}, ${r.camera_id}, ${r.lenz_sing}, ${r.lenz_matr}, ${r.federe}, ${r.telo_doccia},
            ${r.telo_viso}, ${r.telo_ospite}, ${r.tappetini}, ${r.copriletto}, ${r.piumone}, ${now})
    ON CONFLICT (data, camera_id) DO UPDATE SET
      lenz_sing = EXCLUDED.lenz_sing,
      lenz_matr = EXCLUDED.lenz_matr,
      federe = EXCLUDED.federe,
      telo_doccia = EXCLUDED.telo_doccia,
      telo_viso = EXCLUDED.telo_viso,
      telo_ospite = EXCLUDED.telo_ospite,
      tappetini = EXCLUDED.tappetini,
      copriletto = EXCLUDED.copriletto,
      piumone = EXCLUDED.piumone,
      updated_at = EXCLUDED.updated_at
  `));
}

// Listino prezzi unitari della lavanderia, salvato in impostazioni (tipo 'lavanderia_prezzo', chiave = capo)
export async function leggiPrezziLavanderia(): Promise<Record<CapoBiancheria, number>> {
  const rows = await sql`SELECT chiave, valore FROM impostazioni WHERE tipo = 'lavanderia_prezzo'`;
  const prezzi = Object.fromEntries(CAPI_BIANCHERIA.map((c) => [c.key, 0])) as Record<CapoBiancheria, number>;
  for (const r of rows) {
    if (r.chiave in prezzi) prezzi[r.chiave as CapoBiancheria] = Number(r.valore) || 0;
  }
  return prezzi;
}

export async function scriviPrezziLavanderia(prezzi: Partial<Record<CapoBiancheria, number>>): Promise<void> {
  await Promise.all(CAPI_BIANCHERIA.filter((c) => prezzi[c.key] !== undefined).map((c) => sql`
    INSERT INTO impostazioni (tipo, chiave, valore) VALUES ('lavanderia_prezzo', ${c.key}, ${String(prezzi[c.key])})
    ON CONFLICT (tipo, chiave) DO UPDATE SET valore = EXCLUDED.valore
  `));
}
