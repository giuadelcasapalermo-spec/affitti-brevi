import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStrutturaAttiva } from '@/lib/strutture';
import sql from '@/lib/postgres';

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

function csvRow(fields: (string | number)[]): string {
  return fields.map(f => `"${String(f).replace(/"/g, '""')}"`).join(';');
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const strutturaId = cookieStore.get('struttura_id')?.value;
  const struttura = await getStrutturaAttiva(strutturaId);

  const anno = parseInt(req.nextUrl.searchParams.get('anno') ?? String(new Date().getFullYear()));
  const trim = parseInt(req.nextUrl.searchParams.get('trimestre') ?? '1');
  const { dal, al } = trimestreBounds(anno, trim);

  const prenRows = await sql`
    SELECT id, ospite_nome, camera_id, check_in, check_out, tassa_soggiorno
    FROM prenotazioni
    WHERE struttura_id = ${struttura.id}
      AND stato != 'cancellata'
      AND check_in >= ${dal}
      AND check_in <= ${al}
    ORDER BY check_in, camera_id
  `;

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

  const nomiCamere = struttura.nomi_camere ?? {};

  const header = csvRow(['Check-in', 'Check-out', 'Ospite', 'Camera', 'Notti', 'Notti tassabili (max 4)', 'N. Ospiti', 'Tassa riscossa (€)']);
  const righe = prenRows.map(r => {
    const cin  = new Date(r.check_in as string);
    const cout = new Date(r.check_out as string);
    const notti = Math.max(1, Math.round((cout.getTime() - cin.getTime()) / 86400000));
    const nottiTassabili = Math.min(notti, 4);
    const nOspiti = ospiti[r.id as string] ?? 1;
    const nomeCamera = nomiCamere[r.camera_id as number] ?? `Camera ${r.camera_id}`;
    return csvRow([
      r.check_in as string,
      r.check_out as string,
      r.ospite_nome as string,
      nomeCamera,
      notti,
      nottiTassabili,
      nOspiti,
      ((r.tassa_soggiorno as number | null) ?? 0).toFixed(2),
    ]);
  });

  // Totali
  const totRiscossa = prenRows.reduce((s, r) => s + ((r.tassa_soggiorno as number | null) ?? 0), 0);
  const totNotti = prenRows.reduce((r, p) => {
    const cin  = new Date(p.check_in as string);
    const cout = new Date(p.check_out as string);
    return r + Math.min(Math.max(1, Math.round((cout.getTime() - cin.getTime()) / 86400000)), 4);
  }, 0);
  const totOspiti = Object.values(ospiti).reduce((s, n) => s + n, prenRows.length - Object.keys(ospiti).length);

  righe.push('');
  righe.push(csvRow(['TOTALI', '', '', '', '', totNotti, totOspiti, totRiscossa.toFixed(2)]));

  const csv = [header, ...righe].join('\r\n');
  const filename = `tassa-soggiorno-${anno}-Q${trim}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
