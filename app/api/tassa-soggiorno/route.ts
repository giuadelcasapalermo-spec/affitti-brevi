import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStrutturaAttiva } from '@/lib/strutture';
import sql from '@/lib/postgres';
import { randomUUID } from 'crypto';

let _tableReady = false;

async function ensureTable() {
  if (_tableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS tassa_soggiorno_dichiarazioni (
      id TEXT PRIMARY KEY,
      struttura_id TEXT NOT NULL,
      anno INT NOT NULL,
      trimestre INT NOT NULL,
      importo_versato REAL NOT NULL DEFAULT 0,
      data_dichiarazione TEXT,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tsd_struttura_anno_trim
    ON tassa_soggiorno_dichiarazioni(struttura_id, anno, trimestre)
  `;
  await sql`ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS tassa_esenti INT NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS tassa_trovata REAL`;
  _tableReady = true;
}

function trimestreBounds(anno: number, trim: number): { dal: string; al: string } {
  const mesi: Record<number, [number, number]> = {
    1: [1, 3], 2: [4, 6], 3: [7, 9], 4: [10, 12],
  };
  const [mIn, mFin] = mesi[trim];
  const dal = `${anno}-${String(mIn).padStart(2, '0')}-01`;
  const ultimoGiorno = new Date(anno, mFin, 0).getDate();
  const al = `${anno}-${String(mFin).padStart(2, '0')}-${ultimoGiorno}`;
  return { dal, al };
}

function meseBounds(anno: number, mese: number): { dal: string; al: string } {
  const dal = `${anno}-${String(mese).padStart(2, '0')}-01`;
  const ultimoGiorno = new Date(anno, mese, 0).getDate();
  const al = `${anno}-${String(mese).padStart(2, '0')}-${ultimoGiorno}`;
  return { dal, al };
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const strutturaId = cookieStore.get('struttura_id')?.value;
  const struttura = await getStrutturaAttiva(strutturaId);
  await ensureTable();

  const anno = parseInt(req.nextUrl.searchParams.get('anno') ?? String(new Date().getFullYear()));
  const meseParam = req.nextUrl.searchParams.get('mese');
  const trim = parseInt(req.nextUrl.searchParams.get('trimestre') ?? String(Math.ceil((new Date().getMonth() + 1) / 3)));
  const mese = meseParam ? parseInt(meseParam) : null;
  const { dal, al } = mese ? meseBounds(anno, mese) : trimestreBounds(anno, trim);

  const prenRows = await sql`
    SELECT id, ospite_nome, camera_id, check_in, check_out, tassa_soggiorno, tassa_esenti, tassa_trovata
    FROM prenotazioni
    WHERE struttura_id = ${struttura.id}
      AND stato != 'cancellata'
      AND check_in >= ${dal}
      AND check_in <= ${al}
    ORDER BY check_in, camera_id
  `;

  // Ospiti registrati per prenotazione (da alloggiati)
  const allogRows = await sql`
    SELECT prenotazione_id, COUNT(*)::int AS n
    FROM alloggiati
    WHERE struttura_id = ${struttura.id}
      AND data_arrivo >= ${dal}
      AND data_arrivo <= ${al}
    GROUP BY prenotazione_id
  `;
  const ospiti: Record<string, number> = {};
  for (const r of allogRows) ospiti[r.prenotazione_id as string] = r.n as number;

  const prenotazioni = prenRows.map(r => {
    const cin  = new Date(r.check_in as string);
    const cout = new Date(r.check_out as string);
    const notti = Math.max(1, Math.round((cout.getTime() - cin.getTime()) / 86400000));
    const nottiTassabili = Math.min(notti, 4); // Palermo: max 4 notti consecutive
    const nOspiti = ospiti[r.id as string] ?? 1;
    const esenti = (r.tassa_esenti as number | null) ?? 0;
    return {
      id: r.id as string,
      ospite_nome: r.ospite_nome as string,
      camera_id: r.camera_id as number,
      check_in: r.check_in as string,
      check_out: r.check_out as string,
      notti,
      notti_tassabili: nottiTassabili,
      n_ospiti: nOspiti,
      esenti,
      adulti: Math.max(0, nOspiti - esenti),
      tassa_riscossa: (r.tassa_soggiorno as number | null) ?? 0,
      tassa_trovata: (r.tassa_trovata as number | null) ?? null,
    };
  });

  // La dichiarazione formale è solo trimestrale (comunicazione al Comune)
  const dichRows = mese ? [] : await sql`
    SELECT * FROM tassa_soggiorno_dichiarazioni
    WHERE struttura_id = ${struttura.id} AND anno = ${anno} AND trimestre = ${trim}
  `;

  return NextResponse.json({
    prenotazioni,
    totale_riscosso: prenotazioni.reduce((s, p) => s + p.tassa_riscossa, 0),
    notti_totali: prenotazioni.reduce((s, p) => s + p.notti_tassabili, 0),
    ospiti_totali: prenotazioni.reduce((s, p) => s + p.n_ospiti, 0),
    adulti_totali: prenotazioni.reduce((s, p) => s + p.adulti, 0),
    esenti_totali: prenotazioni.reduce((s, p) => s + p.esenti, 0),
    dichiarazione: dichRows[0] ?? null,
  });
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const strutturaId = cookieStore.get('struttura_id')?.value;
  const struttura = await getStrutturaAttiva(strutturaId);
  await ensureTable();

  const body = await req.json();
  const { anno, trimestre, importo_versato, data_dichiarazione, note } = body;

  await sql`
    INSERT INTO tassa_soggiorno_dichiarazioni
      (id, struttura_id, anno, trimestre, importo_versato, data_dichiarazione, note, created_at)
    VALUES
      (${randomUUID()}, ${struttura.id}, ${anno}, ${trimestre},
       ${importo_versato ?? 0}, ${data_dichiarazione ?? null}, ${note ?? ''}, ${new Date().toISOString()})
    ON CONFLICT (struttura_id, anno, trimestre) DO UPDATE SET
      importo_versato   = EXCLUDED.importo_versato,
      data_dichiarazione = EXCLUDED.data_dichiarazione,
      note              = EXCLUDED.note
  `;

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const strutturaId = cookieStore.get('struttura_id')?.value;
  const struttura = await getStrutturaAttiva(strutturaId);
  await ensureTable();

  const { prenotazione_id, tassa_soggiorno, tassa_esenti, tassa_trovata } = await req.json();

  if (tassa_soggiorno !== undefined) {
    await sql`
      UPDATE prenotazioni
      SET tassa_soggiorno = ${tassa_soggiorno ?? 0}
      WHERE id = ${prenotazione_id} AND struttura_id = ${struttura.id}
    `;
  }
  if (tassa_esenti !== undefined) {
    await sql`
      UPDATE prenotazioni
      SET tassa_esenti = ${tassa_esenti ?? 0}
      WHERE id = ${prenotazione_id} AND struttura_id = ${struttura.id}
    `;
  }
  if (tassa_trovata !== undefined) {
    await sql`
      UPDATE prenotazioni
      SET tassa_trovata = ${tassa_trovata}
      WHERE id = ${prenotazione_id} AND struttura_id = ${struttura.id}
    `;
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const cookieStore = await cookies();
  const strutturaId = cookieStore.get('struttura_id')?.value;
  const struttura = await getStrutturaAttiva(strutturaId);
  await ensureTable();

  const anno = parseInt(req.nextUrl.searchParams.get('anno') ?? '0');
  const trimestre = parseInt(req.nextUrl.searchParams.get('trimestre') ?? '0');

  await sql`
    DELETE FROM tassa_soggiorno_dichiarazioni
    WHERE struttura_id = ${struttura.id} AND anno = ${anno} AND trimestre = ${trimestre}
  `;

  return NextResponse.json({ ok: true });
}
