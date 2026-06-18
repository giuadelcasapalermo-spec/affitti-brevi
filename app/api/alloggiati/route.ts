import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStrutturaAttiva } from '@/lib/strutture';
import { leggiAlloggiati, creaAlloggiato } from '@/lib/alloggiati-db';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const strutturaId = cookieStore.get('struttura_id')?.value;
  const struttura = await getStrutturaAttiva(strutturaId);
  const data = req.nextUrl.searchParams.get('data') ?? undefined;
  const alloggiati = await leggiAlloggiati(struttura.id, data);
  return NextResponse.json(alloggiati);
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const strutturaId = cookieStore.get('struttura_id')?.value;
  const struttura = await getStrutturaAttiva(strutturaId);
  const body = await req.json();
  const alloggiato = await creaAlloggiato({
    struttura_id: struttura.id,
    prenotazione_id: body.prenotazione_id ?? undefined,
    tipo: body.tipo,
    data_arrivo: body.data_arrivo,
    permanenza: Number(body.permanenza ?? 1),
    cognome: body.cognome ?? '',
    nome: body.nome ?? '',
    sesso: body.sesso ?? 'M',
    data_nascita: body.data_nascita ?? '',
    comune_nascita: body.comune_nascita ?? '',
    provincia_nascita: body.provincia_nascita ?? '',
    stato_nascita: body.stato_nascita ?? '',
    cittadinanza: body.cittadinanza ?? '',
    tipo_documento: body.tipo_documento ?? '',
    numero_documento: body.numero_documento ?? '',
    luogo_rilascio: body.luogo_rilascio ?? '',
  });
  return NextResponse.json(alloggiato, { status: 201 });
}
