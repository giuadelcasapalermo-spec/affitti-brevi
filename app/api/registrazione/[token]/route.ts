import { NextRequest, NextResponse } from 'next/server';
import { leggiLink } from '@/lib/link-alloggiati';
import { creaAlloggiato } from '@/lib/alloggiati';
import { TipoAlloggiato } from '@/lib/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const link = await leggiLink(token);
  if (!link) {
    return NextResponse.json({ errore: 'Link non valido' }, { status: 404 });
  }
  if (link.usato) {
    return NextResponse.json({ errore: 'Link già utilizzato' }, { status: 410 });
  }
  return NextResponse.json({
    valido: true,
    nomeOspite: link.nome_ospite,
    dataArrivo: link.data_arrivo,
    permanenza: link.permanenza,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const link = await leggiLink(token);
  if (!link) {
    return NextResponse.json({ errore: 'Link non valido' }, { status: 404 });
  }
  if (link.usato) {
    return NextResponse.json({ errore: 'Link già utilizzato' }, { status: 410 });
  }

  const body = await req.json();

  await creaAlloggiato({
    struttura_id: link.struttura_id,
    prenotazione_id: link.prenotazione_id,
    tipo: (body.tipo ?? '16') as TipoAlloggiato,
    data_arrivo: link.data_arrivo,
    permanenza: link.permanenza,
    cognome: body.cognome ?? '',
    nome: body.nome ?? '',
    sesso: body.sesso === 'F' ? 'F' : 'M',
    data_nascita: body.data_nascita ?? '',
    comune_nascita: body.comune_nascita ?? '',
    provincia_nascita: body.provincia_nascita ?? '',
    stato_nascita: body.stato_nascita ?? '',
    cittadinanza: body.cittadinanza ?? '',
    tipo_documento: body.tipo_documento ?? '',
    numero_documento: body.numero_documento ?? '',
    luogo_rilascio: body.luogo_rilascio ?? '',
  });

  return NextResponse.json({ ok: true });
}
