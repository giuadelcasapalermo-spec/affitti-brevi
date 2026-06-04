import { NextRequest, NextResponse } from 'next/server';
import { aggiornaPrezziPeriodo, eliminaPrezziPeriodo } from '@/lib/prezzi';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  await aggiornaPrezziPeriodo(id, {
    ...(body.nome_periodo    !== undefined ? { nome_periodo:    body.nome_periodo }                                      : {}),
    ...(body.data_inizio     !== undefined ? { data_inizio:     body.data_inizio }                                       : {}),
    ...(body.data_fine       !== undefined ? { data_fine:       body.data_fine }                                         : {}),
    ...(body.prezzo_notte    !== undefined ? { prezzo_notte:    Number(body.prezzo_notte) }                              : {}),
    ...(body.prezzo_booking  !== undefined ? { prezzo_booking:  body.prezzo_booking  != null ? Number(body.prezzo_booking)  : null } : {}),
    ...(body.prezzo_airbnb   !== undefined ? { prezzo_airbnb:   body.prezzo_airbnb   != null ? Number(body.prezzo_airbnb)   : null } : {}),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await eliminaPrezziPeriodo(id);
  return NextResponse.json({ ok: true });
}
