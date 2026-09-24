import { NextRequest, NextResponse } from 'next/server';
import { leggiPrezziLavanderia, scriviPrezziLavanderia } from '@/lib/biancheria';
import { CAPI_BIANCHERIA, CapoBiancheria } from '@/lib/types';

export async function GET() {
  return NextResponse.json(await leggiPrezziLavanderia());
}

// PUT { lenz_sing: 0.9, ... }
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const prezzi: Partial<Record<CapoBiancheria, number>> = {};
  CAPI_BIANCHERIA.forEach((c) => {
    const v = Number(body?.[c.key]);
    if (Number.isFinite(v) && v >= 0) prezzi[c.key] = Math.round(v * 100) / 100;
  });
  await scriviPrezziLavanderia(prezzi);
  return NextResponse.json(await leggiPrezziLavanderia());
}
