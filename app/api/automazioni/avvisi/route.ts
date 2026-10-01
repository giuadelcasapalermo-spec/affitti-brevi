// Avvisi delle automazioni (invio schedine Alloggiati Web non riuscito) per il banner dell'app
import { NextRequest, NextResponse } from 'next/server';
import { leggiAvvisiApp, chiudiAvvisoApp } from '@/lib/automazioni';

export async function GET() {
  return NextResponse.json(await leggiAvvisiApp());
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ errore: 'id mancante' }, { status: 400 });
  await chiudiAvvisoApp(id);
  return NextResponse.json({ ok: true });
}
