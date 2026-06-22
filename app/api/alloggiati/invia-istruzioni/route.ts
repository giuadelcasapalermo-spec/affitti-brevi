import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStrutturaAttiva } from '@/lib/strutture';
import { leggiPrenotazioni } from '@/lib/db';

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

    const stanza = pren.camera_id;
    const imposta = pren.tassa_soggiorno ?? 0;
    const importaStr = imposta > 0 ? `€${imposta.toFixed(0)}` : '(da confermare)';

    const testo =
`Buongiorno ${pren.ospite_nome},
appena arriva in ${struttura.indirizzo || struttura.nome} può accedere in questo modo: chiami il citofono e scelga GiuAdel, aprirò la porta da remoto. Salga al quarto piano e inserisca il codice 315518 sul tastierino vicino alla porta. La sua stanza è il numero ${stanza}; le chiavi sono appese al sistema che attiva la luce all'interno della stanza.
La preghiamo di lasciare ${importaStr} in contanti nel cassetto della scrivania come tassa di soggiorno. Faccia attenzione a chiudere bene le porte dell'ascensore al suo piano, la serratura è rotta. Al check-out lasci le chiavi appese.
Per connettersi alla rete Wi-Fi: nome rete WNOTRE-ABE4F8, password 8v85jgfzey26cjms.
Grazie e buon soggiorno!

---

Good morning ${pren.ospite_nome},
when you arrive at ${struttura.indirizzo || struttura.nome}, call the intercom and choose GiuAdel — I will open the door remotely. Go up to the fourth floor and enter code 315518 on the keypad next to the door. Your room is number ${stanza}; the keys are on the system that activates the room light.
Please leave ${importaStr} in cash in the desk drawer for the city tax. Please close the elevator doors properly on your floor as the lock is broken. Leave the keys hanging at check-out.
Wi-Fi network: WNOTRE-ABE4F8, password: 8v85jgfzey26cjms.
Thank you and enjoy your stay!`;

    return NextResponse.json({ ok: true, testo, telefono: pren.ospite_telefono });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ errore: msg }, { status: 500 });
  }
}
