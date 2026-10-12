import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { getStrutturaAttiva } from '@/lib/strutture';
import { leggiContatti, aggiungiContatto, campiContatto } from '@/lib/contatti';

async function strutturaId(): Promise<string> {
  const cookieStore = await cookies();
  return (await getStrutturaAttiva(cookieStore.get('struttura_id')?.value)).id;
}

/** Rubrica della struttura attiva */
export async function GET() {
  return NextResponse.json(await leggiContatti(await strutturaId()));
}

export async function POST(req: NextRequest) {
  const campi = campiContatto(await req.json());
  if (!campi) return NextResponse.json({ error: 'Il nome è obbligatorio' }, { status: 400 });
  const nuovo = { ...campi, id: randomUUID(), struttura_id: await strutturaId(), created_at: new Date().toISOString() };
  await aggiungiContatto(nuovo);
  return NextResponse.json(nuovo, { status: 201 });
}
