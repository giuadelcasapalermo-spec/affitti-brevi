import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStrutturaAttiva } from '@/lib/strutture';
import { inviaOsservatorioStruttura } from '@/lib/osservatorio';

export const preferredRegion = 'fra1';
export const maxDuration = 120;

// POST — invio immediato all'Osservatorio per la struttura attiva (arrivi e partenze fino a oggi, chiusura di oggi)
export async function POST() {
  const cookieStore = await cookies();
  const struttura = await getStrutturaAttiva(cookieStore.get('struttura_id')?.value);
  try {
    const esiti = await inviaOsservatorioStruttura(struttura);
    return NextResponse.json({ ok: !esiti.some(e => e.esito === 'errore'), esiti });
  } catch (e) {
    return NextResponse.json({ ok: false, errore: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
