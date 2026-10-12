import sql from './postgres';
import { Ricevuta, SerieRicevuta } from './types';

let _ready = false;
async function ensureTable(): Promise<void> {
  if (_ready) return;
  await sql`
    CREATE TABLE IF NOT EXISTS ricevute (
      id TEXT PRIMARY KEY,
      serie TEXT NOT NULL DEFAULT 'privato',
      riferimento TEXT,
      anno INTEGER NOT NULL,
      numero INTEGER NOT NULL,
      data_emissione TEXT NOT NULL,
      intestatario TEXT NOT NULL,
      codice_fiscale TEXT NOT NULL DEFAULT '',
      indirizzo TEXT NOT NULL DEFAULT '',
      descrizione TEXT NOT NULL,
      dal TEXT,
      al TEXT,
      importo NUMERIC(10,2) NOT NULL,
      tassa NUMERIC(10,2) NOT NULL DEFAULT 0,
      bollo BOOLEAN NOT NULL DEFAULT false,
      mezzo_pagamento TEXT NOT NULL DEFAULT '',
      dettagli JSONB,
      emittente JSONB NOT NULL,
      created_at TEXT NOT NULL
    )
  `;
  // Prima versione (12/10/2026): una sola serie, legata all'entrata con entrata_id e numerata con UNIQUE (anno, numero)
  await sql`ALTER TABLE ricevute ADD COLUMN IF NOT EXISTS serie TEXT NOT NULL DEFAULT 'privato'`;
  await sql`ALTER TABLE ricevute ADD COLUMN IF NOT EXISTS riferimento TEXT`;
  await sql`ALTER TABLE ricevute ADD COLUMN IF NOT EXISTS dettagli JSONB`;
  const [vecchia] = await sql`
    SELECT 1 FROM information_schema.columns WHERE table_name = 'ricevute' AND column_name = 'entrata_id'
  `;
  if (vecchia) {
    await sql`UPDATE ricevute SET riferimento = entrata_id WHERE riferimento IS NULL`;
    await sql`ALTER TABLE ricevute ALTER COLUMN entrata_id DROP NOT NULL`;
  }
  await sql`ALTER TABLE ricevute DROP CONSTRAINT IF EXISTS ricevute_anno_numero_key`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS ricevute_serie_anno_numero ON ricevute (serie, anno, numero)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS ricevute_serie_riferimento ON ricevute (serie, riferimento)`;
  _ready = true;
}

function daRiga(r: Record<string, unknown>): Ricevuta {
  return {
    id: String(r.id),
    serie: r.serie as SerieRicevuta,
    riferimento: String(r.riferimento),
    anno: Number(r.anno),
    numero: Number(r.numero),
    data_emissione: String(r.data_emissione),
    intestatario: String(r.intestatario),
    codice_fiscale: String(r.codice_fiscale ?? ''),
    indirizzo: String(r.indirizzo ?? ''),
    descrizione: String(r.descrizione),
    dal: (r.dal as string | null) ?? null,
    al: (r.al as string | null) ?? null,
    importo: Number(r.importo),
    tassa: Number(r.tassa),
    bollo: !!r.bollo,
    mezzo_pagamento: String(r.mezzo_pagamento ?? ''),
    dettagli: (r.dettagli as [string, string][] | null) ?? null,
    emittente: r.emittente as Ricevuta['emittente'],
    created_at: String(r.created_at),
  };
}

/** Ricevute di una serie (tutte se assente), opzionalmente per data di emissione dal/al inclusi */
export async function leggiRicevute(f: { serie?: SerieRicevuta; dal?: string; al?: string } = {}): Promise<Ricevuta[]> {
  await ensureTable();
  const rows = await sql`
    SELECT * FROM ricevute
    WHERE (${f.serie ?? null}::text IS NULL OR serie = ${f.serie ?? null})
      AND (${f.dal ?? null}::text IS NULL OR data_emissione >= ${f.dal ?? null})
      AND (${f.al ?? null}::text IS NULL OR data_emissione <= ${f.al ?? null})
    ORDER BY serie, anno, numero
  `;
  return rows.map(daRiga);
}

export type DatiRicevuta = Omit<Ricevuta, 'id' | 'anno' | 'numero' | 'created_at'>;

/**
 * Emette la ricevuta (una per riferimento e serie) o aggiorna quella già emessa mantenendo
 * data, anno e numero. Il numero è il successivo della serie nell'anno della data di emissione.
 */
export async function emettiRicevuta(d: DatiRicevuta): Promise<Ricevuta> {
  await ensureTable();
  const anno = Number(d.data_emissione.slice(0, 4));
  const id = crypto.randomUUID();
  // Due emissioni contemporanee possono calcolare lo stesso numero: l'indice unico ne fa fallire una, si riprova
  for (let tentativo = 0; ; tentativo++) {
    try {
      const rows = await sql`
        INSERT INTO ricevute (id, serie, riferimento, anno, numero, data_emissione, intestatario, codice_fiscale,
                              indirizzo, descrizione, dal, al, importo, tassa, bollo, mezzo_pagamento,
                              dettagli, emittente, created_at)
        SELECT ${id}, ${d.serie}::text, ${d.riferimento}::text, ${anno}::int,
               COALESCE((SELECT MAX(numero) FROM ricevute WHERE serie = ${d.serie} AND anno = ${anno}), 0) + 1,
               ${d.data_emissione}, ${d.intestatario}, ${d.codice_fiscale}, ${d.indirizzo}, ${d.descrizione},
               ${d.dal}::text, ${d.al}::text, ${d.importo}::numeric, ${d.tassa}::numeric, ${d.bollo}::boolean,
               ${d.mezzo_pagamento}::text,
               ${d.dettagli ? JSON.stringify(d.dettagli) : null}::jsonb,
               ${JSON.stringify(d.emittente)}::jsonb,
               ${new Date().toISOString()}
        ON CONFLICT (serie, riferimento) DO UPDATE SET
          intestatario = EXCLUDED.intestatario,
          codice_fiscale = EXCLUDED.codice_fiscale,
          indirizzo = EXCLUDED.indirizzo,
          descrizione = EXCLUDED.descrizione,
          dal = EXCLUDED.dal,
          al = EXCLUDED.al,
          importo = EXCLUDED.importo,
          tassa = EXCLUDED.tassa,
          bollo = EXCLUDED.bollo,
          mezzo_pagamento = EXCLUDED.mezzo_pagamento,
          dettagli = EXCLUDED.dettagli,
          emittente = EXCLUDED.emittente
        RETURNING *
      `;
      return daRiga(rows[0]);
    } catch (e) {
      if (tentativo >= 2 || !String(e).includes('ricevute_serie_anno_numero')) throw e;
    }
  }
}
