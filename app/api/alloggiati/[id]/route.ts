import { NextRequest, NextResponse } from 'next/server';
import { aggiornaAlloggiato, eliminaAlloggiato } from '@/lib/alloggiati';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const updated = await aggiornaAlloggiato(id, {
    prenotazione_id: body.prenotazione_id ?? undefined,
    tipo: body.tipo,
    data_arrivo: body.data_arrivo,
    permanenza: body.permanenza !== undefined ? Number(body.permanenza) : undefined,
    cognome: body.cognome,
    nome: body.nome,
    sesso: body.sesso,
    data_nascita: body.data_nascita,
    comune_nascita: body.comune_nascita,
    provincia_nascita: body.provincia_nascita,
    stato_nascita: body.stato_nascita,
    cittadinanza: body.cittadinanza,
    tipo_documento: body.tipo_documento,
    numero_documento: body.numero_documento,
    luogo_rilascio: body.luogo_rilascio,
  });
  if (!updated) return NextResponse.json({ error: 'Non trovato' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await eliminaAlloggiato(id);
  return NextResponse.json({ ok: true });
}
