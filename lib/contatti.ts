import sql from './postgres';
import { Contatto, CATEGORIE_CONTATTO, CategoriaContatto } from './types';

let _ready = false;
async function ensureTable(): Promise<void> {
  if (_ready) return;
  await sql`
    CREATE TABLE IF NOT EXISTS contatti (
      id TEXT PRIMARY KEY,
      struttura_id TEXT NOT NULL,
      categoria TEXT NOT NULL,
      nome TEXT NOT NULL,
      azienda TEXT NOT NULL DEFAULT '',
      cellulare TEXT NOT NULL DEFAULT '',
      telefono TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS contatti_struttura ON contatti (struttura_id)`;
  _ready = true;
}

/** Campi modificabili ripuliti; null se manca il nome */
export function campiContatto(body: Record<string, unknown>): Omit<Contatto, 'id' | 'struttura_id' | 'created_at'> | null {
  const s = (k: string) => String(body[k] ?? '').trim();
  if (!s('nome')) return null;
  const categoria = (CATEGORIE_CONTATTO as readonly string[]).includes(s('categoria'))
    ? s('categoria') as CategoriaContatto
    : 'Altro';
  return {
    categoria,
    nome: s('nome'),
    azienda: s('azienda'),
    cellulare: s('cellulare'),
    telefono: s('telefono'),
    email: s('email'),
    note: s('note'),
  };
}

export async function leggiContatti(strutturaId: string): Promise<Contatto[]> {
  await ensureTable();
  const rows = await sql`
    SELECT * FROM contatti WHERE struttura_id = ${strutturaId} ORDER BY categoria, lower(nome)
  `;
  return rows as unknown as Contatto[];
}

export async function aggiungiContatto(c: Contatto): Promise<void> {
  await ensureTable();
  await sql`
    INSERT INTO contatti (id, struttura_id, categoria, nome, azienda, cellulare, telefono, email, note, created_at)
    VALUES (${c.id}, ${c.struttura_id}, ${c.categoria}, ${c.nome}, ${c.azienda}, ${c.cellulare},
            ${c.telefono}, ${c.email}, ${c.note}, ${c.created_at})
  `;
}

export async function aggiornaContatto(id: string, strutturaId: string,
  c: Omit<Contatto, 'id' | 'struttura_id' | 'created_at'>): Promise<Contatto | null> {
  await ensureTable();
  const rows = await sql`
    UPDATE contatti SET categoria = ${c.categoria}, nome = ${c.nome}, azienda = ${c.azienda},
      cellulare = ${c.cellulare}, telefono = ${c.telefono}, email = ${c.email}, note = ${c.note}
    WHERE id = ${id} AND struttura_id = ${strutturaId}
    RETURNING *
  `;
  return (rows[0] as unknown as Contatto) ?? null;
}

export async function eliminaContatto(id: string, strutturaId: string): Promise<boolean> {
  await ensureTable();
  const rows = await sql`DELETE FROM contatti WHERE id = ${id} AND struttura_id = ${strutturaId} RETURNING id`;
  return rows.length > 0;
}
