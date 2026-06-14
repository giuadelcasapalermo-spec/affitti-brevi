import { NextRequest, NextResponse } from 'next/server';
import { leggiEntrate, aggiungiEntrata } from '@/lib/entrate';
import { Entrata } from '@/lib/types';
import { randomUUID } from 'crypto';

export async function GET() {
  return NextResponse.json(await leggiEntrate());
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const nuova: Entrata = {
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

  await aggiungiEntrata(nuova);
  return NextResponse.json(nuova, { status: 201 });
}
