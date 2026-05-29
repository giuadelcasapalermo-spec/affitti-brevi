import { NextRequest, NextResponse } from 'next/server';
import { leggiPrezziPeriodi, creaPrezziPeriodo } from '@/lib/prezzi';
import { cookies } from 'next/headers';
import { getStrutturaAttiva } from '@/lib/strutture';

export async function GET() {
  const cookieStore = await cookies();
  const strutturaId = cookieStore.get('struttura_id')?.value;
  const struttura = await getStrutturaAttiva(strutturaId);
  const periodi = await leggiPrezziPeriodi(undefined, struttura.id);
  return NextResponse.json(periodi);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const cookieStore = await cookies();
  const strutturaId = cookieStore.get('struttura_id')?.value;
  const struttura = await getStrutturaAttiva(strutturaId);
  const record = await creaPrezziPeriodo(
    struttura.id,
    Number(body.camera_id),
    body.nome_periodo ?? '',
    body.data_inizio,
    body.data_fine,
    Number(body.prezzo_notte),
  );
  return NextResponse.json(record, { status: 201 });
}
