import { NextRequest, NextResponse } from 'next/server';
import { aggiornaUscita, eliminaUscita } from '@/lib/uscite';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const aggiornata = await aggiornaUscita(id, body);
  if (!aggiornata) return NextResponse.json({ error: 'Non trovata' }, { status: 404 });
  return NextResponse.json(aggiornata);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eliminata = await eliminaUscita(id);
  if (!eliminata) return NextResponse.json({ error: 'Non trovata' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
