import sql from './postgres';
import { Ricevuta } from './types';

let _ready = false;
async function ensureTable(): Promise<void> {
  if (_ready) return;
  await sql`
    CREATE TABLE IF NOT EXISTS ricevute (
      id TEXT PRIMARY KEY,
      entrata_id TEXT NOT NULL UNIQUE,
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
      emittente JSONB NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (anno, numero)
    )
  `;
  _ready = true;
}

function daRiga(r: Record<string, unknown>): Ricevuta {
  return {
    ...(r as unknown as Ricevuta),
    anno: Number(r.anno),
    numero: Number(r.numero),
    importo: Number(r.importo),
    tassa: Number(r.tassa),
  };
}

export async function leggiRicevute(): Promise<Ricevuta[]> {
  await ensureTable();
  const rows = await sql`SELECT * FROM ricevute ORDER BY anno DESC, numero DESC`;
  return rows.map(daRiga);
}

export type DatiRicevuta = Omit<Ricevuta, 'id' | 'anno' | 'numero' | 'created_at'>;

/**
 * Emette la ricevuta di un'entrata, o aggiorna quella già emessa mantenendo anno e numero.
 * Il numero è il successivo dell'anno della data di emissione.
 */
export async function emettiRicevuta(d: DatiRicevuta): Promise<Ricevuta> {
  await ensureTable();
  const anno = Number(d.data_emissione.slice(0, 4));
  const id = crypto.randomUUID();
  // Due emissioni contemporanee possono calcolare lo stesso numero: UNIQUE (anno, numero) ne fa fallire una, si riprova
  for (let tentativo = 0; ; tentativo++) {
    try {
      const rows = await sql`
        INSERT INTO ricevute (id, entrata_id, anno, numero, data_emissione, intestatario, codice_fiscale,
                              indirizzo, descrizione, dal, al, importo, tassa, bollo, mezzo_pagamento, emittente, created_at)
        SELECT ${id}, ${d.entrata_id}, ${anno}::int,
               COALESCE((SELECT MAX(numero) FROM ricevute WHERE anno = ${anno}), 0) + 1,
               ${d.data_emissione}, ${d.intestatario}, ${d.codice_fiscale}, ${d.indirizzo}, ${d.descrizione},
               ${d.dal}::text, ${d.al}::text, ${d.importo}::numeric, ${d.tassa}::numeric, ${d.bollo}::boolean,
               ${d.mezzo_pagamento}::text,
               ${JSON.stringify(d.emittente)}::jsonb,
               ${new Date().toISOString()}
        ON CONFLICT (entrata_id) DO UPDATE SET
          data_emissione = EXCLUDED.data_emissione,
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
          emittente = EXCLUDED.emittente
        RETURNING *
      `;
      return daRiga(rows[0]);
    } catch (e) {
      if (tentativo >= 2 || !String(e).includes('ricevute_anno_numero_key')) throw e;
    }
  }
}
