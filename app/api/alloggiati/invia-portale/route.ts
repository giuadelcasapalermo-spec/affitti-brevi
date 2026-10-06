import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStrutturaAttiva, credenzialiAlloggiati } from '@/lib/strutture';
import { leggiAlloggiati } from '@/lib/alloggiati';
import { marcaInviatiPortale } from '@/lib/alloggiati-db';
import { leggiPrenotazioni } from '@/lib/db';
import { inviaSchedinePortale } from '@/lib/portale-alloggiati';
import type { Alloggiato, AlloggiatiCredentials } from '@/lib/types';

export const preferredRegion = 'fra1'; // Il portale PS blocca IP USA — usa Francoforte (EU)

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const strutturaId = cookieStore.get('struttura_id')?.value;
    const struttura = await getStrutturaAttiva(strutturaId);

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

    // Una spedizione per utenza Alloggiati Web: la camera della prenotazione decide quali credenziali usare
    const cameraDi = new Map((await leggiPrenotazioni(struttura.id)).map(p => [p.id, p.camera_id]));
    const gruppi = new Map<string, { creds: AlloggiatiCredentials; ospiti: Alloggiato[] }>();
    const senzaCredenziali: Alloggiato[] = [];
    for (const a of alloggiati) {
      const creds = credenzialiAlloggiati(struttura, a.prenotazione_id ? cameraDi.get(a.prenotazione_id) : null);
      if (!creds) { senzaCredenziali.push(a); continue; }
      const g = gruppi.get(creds.utente) ?? { creds, ospiti: [] };
      g.ospiti.push(a);
      gruppi.set(creds.utente, g);
    }
    if (gruppi.size === 0) {
      return NextResponse.json(
        { ok: false, errore: 'Credenziali AlloggiatiWeb non configurate. Vai in Impostazioni → Strutture → AlloggiatiWeb.' },
        { status: 400 }
      );
    }

    let valide = 0;
    const errori: string[] = [];
    for (const [utente, { creds, ospiti }] of gruppi) {
      const esito = await inviaSchedinePortale(creds, ospiti);
      if (esito.ok) {
        await marcaInviatiPortale(esito.inviati);
        valide += esito.valide;
        continue;
      }
      // Con una sola utenza si restituisce l'esito completo (diagnosi, errori di validazione) come prima
      if (gruppi.size === 1) {
        const { tipo, ...resto } = esito;
        if (tipo === 'validazione') return NextResponse.json(resto, { status: 400 });
        if (tipo === 'rete') return NextResponse.json({ ...resto, tipo: 'portale_irraggiungibile' }, { status: 500 });
        return NextResponse.json(resto);
      }
      errori.push(`utenza ${utente}: ${esito.errore}`);
    }

    const giaInviate = tutti.length - alloggiati.length;
    const nonInviate = senzaCredenziali.length
      ? ` ${senzaCredenziali.length} schedine non inviate: mancano le credenziali della camera (${senzaCredenziali.map(a => `${a.nome} ${a.cognome}`).join(', ')}).`
      : '';
    const messaggio = `${valide} schedine inviate al portale con successo${giaInviate ? ` (${giaInviate} già inviate in precedenza)` : ''}.${nonInviate}`;
    if (errori.length || senzaCredenziali.length) {
      return NextResponse.json({ ok: valide > 0, messaggio, errore: [...errori, nonInviate.trim()].filter(Boolean).join(' | ') });
    }
    return NextResponse.json({ ok: true, messaggio });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, errore: msg }, { status: 500 });
  }
}
