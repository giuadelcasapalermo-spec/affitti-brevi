import { NextRequest, NextResponse } from 'next/server';
import { sostituisciTassaGiorno } from '@/lib/entrate';
import { Entrata } from '@/lib/types';
import { randomUUID } from 'crypto';

// PUT { data, descrizione, importo, fonte_pagamento? } → registra la tassa di soggiorno del giorno
export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.data ?? '')) {
    return NextResponse.json({ error: 'Data non valida' }, { status: 400 });
  }
  const entrata: Entrata = {
    id: randomUUID(),
    data: body.data,
    descrizione: body.descrizione ?? '',
    categoria: 'Tasse',
    importo: Number(body.importo) || 0,
    note: '',
    fonte_pagamento: body.fonte_pagamento ?? 'Contanti',
    created_at: new Date().toISOString(),
  };
  const esito = await sostituisciTassaGiorno(entrata);
  return NextResponse.json({ esito });
}
