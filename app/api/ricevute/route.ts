import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import sql from '@/lib/postgres';
import { getStrutturaAttiva, codiciCamera } from '@/lib/strutture';
import { leggiRicevute, emettiRicevuta } from '@/lib/ricevute';
import { SOGLIA_BOLLO } from '@/lib/types';

export async function GET() {
  return NextResponse.json(await leggiRicevute());
}

/** Emette (o aggiorna, stesso numero) la ricevuta di un'entrata "Privato" */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const entrataId = String(body.entrata_id ?? '');
  const intestatario = String(body.intestatario ?? '').trim();
  const dataEmissione = String(body.data_emissione ?? '');
  if (!entrataId || !intestatario || !/^\d{4}-\d{2}-\d{2}$/.test(dataEmissione)) {
    return NextResponse.json({ error: 'Intestatario e data di emissione obbligatori' }, { status: 400 });
  }

  const [entrata] = await sql`SELECT id, categoria, importo, camera_id FROM entrate WHERE id = ${entrataId}`;
  if (!entrata) return NextResponse.json({ error: 'Entrata non trovata' }, { status: 404 });
  if (entrata.categoria !== 'Privato') {
    return NextResponse.json({ error: 'La ricevuta si emette solo per le entrate Privato' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const s = await getStrutturaAttiva(cookieStore.get('struttura_id')?.value);
  const df = s.dati_fiscali;
  const codici = codiciCamera(s, entrata.camera_id as number | null);

  const importo = Number(entrata.importo);
  const tassa = Math.max(0, Number(body.tassa) || 0);
  const ricevuta = await emettiRicevuta({
    entrata_id: entrataId,
    data_emissione: dataEmissione,
    intestatario,
    codice_fiscale: String(body.codice_fiscale ?? '').trim().toUpperCase(),
    indirizzo: String(body.indirizzo ?? '').trim(),
    descrizione: String(body.descrizione ?? '').trim() || 'Pernottamento',
    dal: body.dal || null,
    al: body.al || null,
    importo,
    tassa,
    bollo: body.bollo === undefined ? importo > SOGLIA_BOLLO : !!body.bollo,
    mezzo_pagamento: String(body.mezzo_pagamento ?? '').trim(),
    emittente: {
      nome: df.ragione_sociale || s.nome,
      codice_fiscale: df.codice_fiscale,
      partita_iva: df.partita_iva,
      indirizzo: df.sede_legale || s.indirizzo,
      cin: codici.cin,
      cir: codici.cir,
      struttura: s.nome,
      struttura_indirizzo: s.indirizzo,
    },
  });
  return NextResponse.json(ricevuta);
}
