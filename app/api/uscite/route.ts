import { NextRequest, NextResponse } from 'next/server';
import { leggiUscite, aggiungiUscita } from '@/lib/uscite';
import { Uscita } from '@/lib/types';
import { randomUUID } from 'crypto';

export async function GET() {
  return NextResponse.json(await leggiUscite());
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const nuova: Uscita = {
    id: body.id || randomUUID(),
    data: body.data,
    descrizione: body.descrizione,
    categoria: body.categoria,
    importo: Number(body.importo),
    camera_id: body.camera_id ?? undefined,
    note: body.note ?? '',
    fonte_pagamento: body.fonte_pagamento ?? 'Contanti',
    created_at: new Date().toISOString(),
  };

  await aggiungiUscita(nuova);
  return NextResponse.json(nuova, { status: 201 });
}
