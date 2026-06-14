import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStrutturaAttiva } from '@/lib/strutture';
import { leggiAlloggiati, generaFileAlloggiati, preparaBatchPerPortale } from '@/lib/alloggiati';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const strutturaId = cookieStore.get('struttura_id')?.value;
  const struttura = await getStrutturaAttiva(strutturaId);
  const data = req.nextUrl.searchParams.get('data') ?? new Date().toISOString().split('T')[0];
  const alloggiati = await leggiAlloggiati(struttura.id, data);
  const contenuto = generaFileAlloggiati(preparaBatchPerPortale(alloggiati));
  return new NextResponse(contenuto, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="alloggiati_${data}.txt"`,
    },
  });
}
