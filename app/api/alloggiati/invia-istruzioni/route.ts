import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStrutturaAttiva, codiciCamera, istruzioniCamera } from '@/lib/strutture';
import { leggiPrenotazioni } from '@/lib/db';
import { componiIstruzioni } from '@/lib/istruzioni';

export async function POST(req: NextRequest) {
  try {
    const { prenotazione_id } = await req.json();
    if (!prenotazione_id) {
      return NextResponse.json({ errore: 'prenotazione_id mancante' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const strutturaId = cookieStore.get('struttura_id')?.value;
    const struttura = await getStrutturaAttiva(strutturaId);

    const prenotazioni = await leggiPrenotazioni(struttura.id);
    const pren = prenotazioni.find(p => p.id === prenotazione_id);
    if (!pren) {
      return NextResponse.json({ errore: 'Prenotazione non trovata' }, { status: 404 });
    }
    if (!pren.ospite_telefono) {
      return NextResponse.json({ errore: 'Numero di telefono ospite mancante' }, { status: 400 });
    }

    // Messaggio della camera, se ne ha uno proprio, altrimenti quello della struttura
    const modello = istruzioniCamera(struttura, pren.camera_id);
    if (!modello.trim()) {
      return NextResponse.json(
        { errore: 'Istruzioni di check-in non configurate: impostarle in Altro → Camere → Check-in' },
        { status: 400 },
      );
    }

    const imposta = pren.tassa_soggiorno ?? 0;
    const testo = componiIstruzioni(modello, {
      ospite: pren.ospite_nome,
      camera: pren.camera_id,
      tassa: imposta > 0 ? `€${imposta.toFixed(0)}` : '(da confermare)',
      indirizzo: struttura.indirizzo || struttura.nome,
      struttura: struttura.nome,
      ...codiciCamera(struttura, pren.camera_id),
    });

    return NextResponse.json({ ok: true, testo, telefono: pren.ospite_telefono });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ errore: msg }, { status: 500 });
  }
}
