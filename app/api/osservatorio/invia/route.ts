import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStrutturaAttiva } from '@/lib/strutture';
import { inviaOsservatorioStruttura } from '@/lib/osservatorio';

export const preferredRegion = 'fra1';
export const maxDuration = 300;

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST — invio immediato all'Osservatorio per la struttura attiva.
 * Senza corpo: come l'invio serale (arrivi e partenze fino a oggi, chiusura di oggi).
 * { dal, al, solo_booking, limite } — invio storico: arrivi nell'intervallo, senza chiusure giornaliere
 * (i giorni passati si considerano già chiusi sul portale); limite = 1 per provare con un solo soggiorno.
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const struttura = await getStrutturaAttiva(cookieStore.get('struttura_id')?.value);
  const corpo = await req.json().catch(() => ({})) as { dal?: string; al?: string; solo_booking?: boolean; limite?: number };
  if (corpo.dal && (!DATA.test(corpo.dal) || (corpo.al && !DATA.test(corpo.al)))) {
    return NextResponse.json({ ok: false, errore: 'Date non valide' }, { status: 400 });
  }
  try {
    const esiti = await inviaOsservatorioStruttura(struttura, corpo.dal
      ? { dal: corpo.dal, al: corpo.al, soloBooking: !!corpo.solo_booking, limite: corpo.limite, chiusura: false, avvisi: false }
      : {});
    return NextResponse.json({ ok: !esiti.some(e => e.esito === 'errore'), esiti });
  } catch (e) {
    return NextResponse.json({ ok: false, errore: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
