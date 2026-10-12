import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import sql from '@/lib/postgres';
import { getStrutturaAttiva, codiciCamera } from '@/lib/strutture';
import { leggiRicevute, emettiRicevuta } from '@/lib/ricevute';
import { SOGLIA_BOLLO, SerieRicevuta, EmittenteRicevuta } from '@/lib/types';

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** ?serie=privato|tassa&dal=yyyy-MM-dd&al=yyyy-MM-dd (per data di emissione) */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const serie = p.get('serie');
  const dal = p.get('dal') ?? undefined;
  const al = p.get('al') ?? undefined;
  return NextResponse.json(await leggiRicevute({
    serie: serie === 'privato' || serie === 'tassa' ? serie : undefined,
    dal: dal && DATA.test(dal) ? dal : undefined,
    al: al && DATA.test(al) ? al : undefined,
  }));
}

async function emittente(cameraId: number | null): Promise<EmittenteRicevuta> {
  const cookieStore = await cookies();
  const s = await getStrutturaAttiva(cookieStore.get('struttura_id')?.value);
  const df = s.dati_fiscali;
  const codici = codiciCamera(s, cameraId);
  return {
    nome: df.ragione_sociale || s.nome,
    codice_fiscale: df.codice_fiscale,
    partita_iva: df.partita_iva,
    indirizzo: df.sede_legale || s.indirizzo,
    cin: codici.cin,
    cir: codici.cir,
    struttura: s.nome,
    struttura_indirizzo: s.indirizzo,
  };
}

/**
 * Emette (o aggiorna, stesso numero) una ricevuta.
 * serie privato: entrata_id di un'entrata "Privato"; serie tassa: prenotazione_id, importo e dettagli.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const serie: SerieRicevuta = body.serie === 'tassa' ? 'tassa' : 'privato';
  const intestatario = String(body.intestatario ?? '').trim();
  const dataEmissione = String(body.data_emissione ?? '');
  if (!intestatario || !DATA.test(dataEmissione)) {
    return NextResponse.json({ error: 'Intestatario e data di emissione obbligatori' }, { status: 400 });
  }
  const comuni = {
    data_emissione: dataEmissione,
    intestatario,
    codice_fiscale: String(body.codice_fiscale ?? '').trim().toUpperCase(),
    indirizzo: String(body.indirizzo ?? '').trim(),
    dal: body.dal || null,
    al: body.al || null,
    mezzo_pagamento: String(body.mezzo_pagamento ?? '').trim(),
  };

  if (serie === 'tassa') {
    const prenotazioneId = String(body.prenotazione_id ?? '');
    const [pren] = await sql`SELECT id, camera_id FROM prenotazioni WHERE id = ${prenotazioneId}`;
    if (!pren) return NextResponse.json({ error: 'Prenotazione non trovata' }, { status: 404 });
    const importo = Number(body.importo);
    if (!(importo > 0)) return NextResponse.json({ error: 'Nessuna tassa riscossa per questa prenotazione' }, { status: 400 });
    const dettagli = Array.isArray(body.dettagli)
      ? (body.dettagli as unknown[][]).map(r => [String(r[0]), String(r[1])] as [string, string])
      : null;
    return NextResponse.json(await emettiRicevuta({
      ...comuni,
      serie,
      riferimento: prenotazioneId,
      descrizione: 'Imposta di soggiorno',
      importo,
      tassa: 0,
      bollo: false,
      dettagli,
      emittente: await emittente(pren.camera_id as number | null),
    }));
  }

  const entrataId = String(body.entrata_id ?? '');
  const [entrata] = await sql`SELECT id, categoria, importo, camera_id FROM entrate WHERE id = ${entrataId}`;
  if (!entrata) return NextResponse.json({ error: 'Entrata non trovata' }, { status: 404 });
  if (entrata.categoria !== 'Privato') {
    return NextResponse.json({ error: 'La ricevuta si emette solo per le entrate Privato' }, { status: 400 });
  }
  const importo = Number(entrata.importo);
  return NextResponse.json(await emettiRicevuta({
    ...comuni,
    serie,
    riferimento: entrataId,
    descrizione: String(body.descrizione ?? '').trim() || 'Pernottamento',
    importo,
    // L'imposta di soggiorno ha la sua serie di ricevute
    tassa: 0,
    bollo: body.bollo === undefined ? importo > SOGLIA_BOLLO : !!body.bollo,
    dettagli: null,
    emittente: await emittente(entrata.camera_id as number | null),
  }));
}
