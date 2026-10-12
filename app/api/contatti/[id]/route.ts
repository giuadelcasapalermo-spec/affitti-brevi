import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStrutturaAttiva } from '@/lib/strutture';
import { aggiornaContatto, eliminaContatto, campiContatto } from '@/lib/contatti';

async function strutturaId(): Promise<string> {
  const cookieStore = await cookies();
  return (await getStrutturaAttiva(cookieStore.get('struttura_id')?.value)).id;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campi = campiContatto(await req.json());
  if (!campi) return NextResponse.json({ error: 'Il nome è obbligatorio' }, { status: 400 });
  const aggiornato = await aggiornaContatto(id, await strutturaId(), campi);
  if (!aggiornato) return NextResponse.json({ error: 'Non trovato' }, { status: 404 });
  return NextResponse.json(aggiornato);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await eliminaContatto(id, await strutturaId()))) return NextResponse.json({ error: 'Non trovato' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
