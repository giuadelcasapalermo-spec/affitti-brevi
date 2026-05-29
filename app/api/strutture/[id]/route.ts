import { NextRequest, NextResponse } from 'next/server';
import { aggiornaStruttura, eliminaStruttura } from '@/lib/strutture';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  await aggiornaStruttura(id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await eliminaStruttura(id);
  return NextResponse.json({ ok: true });
}
