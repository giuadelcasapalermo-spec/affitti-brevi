import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import sql from '@/lib/postgres';
import { migraStruttura } from '@/lib/strutture';

/**
 * POST { data: 'AAAA-MM-GG' } — divide in due una prenotazione nel giorno del cambio ospite.
 * Serve per i blocchi del calendario Booking.com: il feed iCal gratuito unisce in un solo evento i soggiorni
 * consecutivi (check-out e check-in nello stesso giorno), quindi l'app non può distinguerli da sola.
 * La prima parte termina il giorno indicato, la seconda inizia lo stesso giorno: entrambe conservano l'UID iCal
 * del blocco, così la sincronizzazione le riconosce e non le cancella né reimporta il blocco intero.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await req.json().catch(() => ({})) as { data?: string };
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ errore: 'Data del cambio non valida' }, { status: 400 });
  }
  await migraStruttura();
  const rows = await sql`SELECT * FROM prenotazioni WHERE id = ${id}`;
  const p = rows[0];
  if (!p) return NextResponse.json({ errore: 'Prenotazione non trovata' }, { status: 404 });
  if (!(data > (p.check_in as string) && data < (p.check_out as string))) {
    return NextResponse.json({ errore: `La data deve essere tra il ${p.check_in} e il ${p.check_out} (esclusi)` }, { status: 400 });
  }

  if (p.fonte === 'airbnb') {
    return NextResponse.json({ errore: 'Le prenotazioni Airbnb arrivano già separate: non serve dividerle' }, { status: 400 });
  }

  const nuovaId = randomUUID();
  const importata = p.fonte === 'ical';
  const nomeGenerico = 'Ospite Booking.com';
  await sql`UPDATE prenotazioni SET check_out = ${data} WHERE id = ${id}`;
  await sql`
    INSERT INTO prenotazioni
      (id, struttura_id, camera_id, ospite_nome, ospite_telefono, ospite_email,
       check_in, check_out, importo_totale, tassa_soggiorno, tassa_esenti, num_ospiti, stato, note, created_at, fonte, ical_uid)
    VALUES
      (${nuovaId}, ${p.struttura_id}, ${p.camera_id}, ${importata ? nomeGenerico : ''}, '', '',
       ${data}, ${p.check_out}, 0, ${null}, 0, ${null}, ${p.stato},
       ${`Divisa da ${p.ospite_nome || 'prenotazione'} (${p.check_in} → ${p.check_out})`}, ${new Date().toISOString()},
       ${p.fonte}, ${p.ical_uid ?? null})
  `;
  return NextResponse.json({ ok: true, prima: { id, check_out: data }, seconda: { id: nuovaId, check_in: data, check_out: p.check_out } });
}
