import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStrutturaAttiva } from '@/lib/strutture';
import { leggiAlloggiati } from '@/lib/alloggiati';
import { marcaInviatiPortale } from '@/lib/alloggiati-db';
import { inviaSchedinePortale } from '@/lib/portale-alloggiati';

export const preferredRegion = 'fra1'; // Il portale PS blocca IP USA — usa Francoforte (EU)

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const strutturaId = cookieStore.get('struttura_id')?.value;
    const struttura = await getStrutturaAttiva(strutturaId);

    const creds = struttura.alloggiati_credentials;
    if (!creds?.utente || !creds?.password || !creds?.wskey) {
      return NextResponse.json(
        { ok: false, errore: 'Credenziali AlloggiatiWeb non configurate. Vai in Impostazioni → Strutture → Modifica.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const data: string = body.data ?? new Date().toISOString().split('T')[0];

    const tutti = await leggiAlloggiati(struttura.id, data);
    if (tutti.length === 0) {
      return NextResponse.json({ ok: false, errore: 'Nessun alloggiato da inviare per questa data.' }, { status: 400 });
    }
    // Le schedine già accettate (anche dall'invio automatico) non si reinviano: il portale le duplicherebbe
    const alloggiati = tutti.filter(a => !a.inviato_portale_at);
    if (alloggiati.length === 0) {
      return NextResponse.json({ ok: false, errore: `Tutte le ${tutti.length} schedine di questa data risultano già inviate al portale.` }, { status: 400 });
    }

    // Avviso se la data è più di 24h nel passato (il portale rifiuta invii tardivi)
    const dataMs = new Date(data).getTime();
    const oraMs = Date.now();
    const oreRitardo = (oraMs - dataMs) / 3_600_000;
    if (oreRitardo > 36) {
      const giorni = Math.floor(oreRitardo / 24);
      return NextResponse.json({
        ok: false,
        errore: `Data ${data} è ${giorni} giorn${giorni === 1 ? 'o' : 'i'} nel passato. AlloggiatiWeb richiede invio entro 24h dall'arrivo. Il portale rifiuterà la schedina con "Data di Arrivo Errata".`,
      }, { status: 400 });
    }

    const esito = await inviaSchedinePortale(creds, alloggiati);
    if (!esito.ok) {
      const { tipo, ...resto } = esito;
      if (tipo === 'validazione') return NextResponse.json(resto, { status: 400 });
      if (tipo === 'rete') return NextResponse.json({ ...resto, tipo: 'portale_irraggiungibile' }, { status: 500 });
      return NextResponse.json(resto);
    }

    await marcaInviatiPortale(esito.inviati);
    const giaInviate = tutti.length - alloggiati.length;
    return NextResponse.json({
      ok: true,
      messaggio: `${esito.valide} schedine inviate al portale con successo${giaInviate ? ` (${giaInviate} già inviate in precedenza)` : ''}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, errore: msg }, { status: 500 });
  }
}
