/**
 * Avvisi "Booking occupata, app libera" della struttura attiva.
 * GET  → elenco (solo le notti ancora libere in app)
 * POST { uid, azione: 'importa' | 'ignora' }
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStrutturaAttiva } from '@/lib/strutture';
import { leggiAvvisiBooking, risolviAvvisoBooking } from '@/lib/ical';
import { leggiPrenotazioni } from '@/lib/db';

export async function GET() {
  const struttura = await getStrutturaAttiva((await cookies()).get('struttura_id')?.value);
  const avvisi = await leggiAvvisiBooking(struttura.id);
  if (avvisi.length === 0) return NextResponse.json([]);
  // Dopo il sync il foglio o un inserimento a mano possono aver già coperto quelle notti
  const vive = (await leggiPrenotazioni(struttura.id)).filter((p) => p.stato !== 'cancellata');
  const aperti = avvisi.filter((a) => {
    let cursore = a.check_in;
    for (const p of vive.filter((p) => p.camera_id === a.camera_id && p.check_in < a.check_out && p.check_out > a.check_in)
      .sort((x, y) => x.check_in.localeCompare(y.check_in))) {
      if (p.check_in > cursore) return true;
      if (p.check_out > cursore) cursore = p.check_out;
    }
    return cursore < a.check_out;
  });
  return NextResponse.json(aperti);
}

export async function POST(req: NextRequest) {
  const { uid, azione } = await req.json().catch(() => ({}));
  if (typeof uid !== 'string' || !uid || (azione !== 'importa' && azione !== 'ignora')) {
    return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 });
  }
  await risolviAvvisoBooking(uid, azione);
  return NextResponse.json({ ok: true });
}
