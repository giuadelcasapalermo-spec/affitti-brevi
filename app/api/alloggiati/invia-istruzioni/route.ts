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
•    Self Check-in: appena arrivate in ${struttura.indirizzo || struttura.nome} potete accedere in questo modo, citofonate scegliendo GiuAdel, aprirò la porta da remoto. Salite al quarto piano e inserite il codice 315518 sul tastierino vicino alla porta. La sua stanza è il numero ${stanza}; le chiavi sono appese al sistema che attiva la luce all'interno della stanza. Al check-out lasciate le chiavi appese.
•    Utilizzo ascensore: Fate la massima attenzione a chiudere bene entrambe le porte dell'ascensore, potrebbero rimanere aperte causando disagi ai condomini del palazzo.
•    Tassa di soggiorno: La preghiamo di lasciare ${importaStr} in contanti nel cassetto della scrivania come tassa di soggiorno.
•    Utilizzo frigorifero: Avete a disposizione un ripiano del frigo con il numero corrispondente a quello della vostra camera.
•    Rete Wi-Fi: Nome rete WNOTRE-ABE4F8, password 8v85j6fzej26cjm5.
Grazie e buon soggiorno!

---

Good morning ${pren.ospite_nome},
•    Self Check-in: as soon as you arrive at ${struttura.indirizzo || struttura.nome} you can access it this way, call the intercom and choose GiuAdel — I will open the door remotely. Go up to the fourth floor and enter code 315518 on the keypad next to the door. Your room is number ${stanza}; the keys are on the system that activates the room light. Leave the keys hanging at check-out.
•    Elevator use: Please be very careful to close both elevator doors properly, as they might stay open and cause inconvenience to the building's residents.
•    City tax: Please leave ${importaStr} in cash in the desk drawer for the city tax.
•    Fridge use: You have a fridge shelf available with the number matching your room.
•    Wi-Fi network: Name WNOTRE-ABE4F8, password 8v85j6fzej26cjm5.
Thank you and enjoy your stay!`;

    return NextResponse.json({ ok: true, testo, telefono: pren.ospite_telefono });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ errore: msg }, { status: 500 });
  }
}
