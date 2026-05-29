import { NextRequest, NextResponse } from 'next/server';
import { leggiStrutture, creaStruttura } from '@/lib/strutture';

export async function GET() {
  return NextResponse.json(await leggiStrutture());
}

export async function POST(req: NextRequest) {
  const { nome, indirizzo = '', num_camere = 5 } = await req.json();
  const s = await creaStruttura(nome, indirizzo, Number(num_camere));
  return NextResponse.json(s, { status: 201 });
}
