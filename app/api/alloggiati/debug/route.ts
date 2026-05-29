import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStrutturaAttiva } from '@/lib/strutture';
import { leggiAlloggiati, generaFileAlloggiati } from '@/lib/alloggiati';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const strutturaId = cookieStore.get('struttura_id')?.value;
  const struttura = await getStrutturaAttiva(strutturaId);
  const data = req.nextUrl.searchParams.get('data') ?? new Date().toISOString().split('T')[0];
  const alloggiati = await leggiAlloggiati(struttura.id, data);
  if (alloggiati.length === 0) return NextResponse.json({ errore: 'Nessun alloggiato per questa data', data });
  const file = generaFileAlloggiati(alloggiati);
  const righe = file.split('\r\n');
  return NextResponse.json({
    data,
    n: alloggiati.length,
    righe: righe.map((r, i) => ({
      i,
      len: r.length,
      raw: r,
      parsed: {
        tipo: r.substring(0, 2),
        dataArrivo: r.substring(2, 12),
        permanenza: r.substring(12, 14),
        cognome: r.substring(14, 64).trimEnd(),
        nome: r.substring(64, 94).trimEnd(),
        sesso: r.substring(94, 95),
        dataNascita: r.substring(95, 105),
        comuneNascita: r.substring(105, 114),
        provinciaNascita: r.substring(114, 116),
        statoNascita: r.substring(116, 125),
        cittadinanza: r.substring(125, 134),
        tipoDoc: r.substring(134, 139),
        numDoc: r.substring(139, 159).trimEnd(),
        luogoRilascio: r.substring(159, 168),
        totalLen: r.length,
      },
    })),
  });
}
