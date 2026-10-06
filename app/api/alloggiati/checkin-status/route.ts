import { NextRequest, NextResponse } from 'next/server';
import { leggiLinksPerPrenotazioni } from '@/lib/link-alloggiati';
import { ensureAlloggiatiTable } from '@/lib/alloggiati-db';
import { leggiIstruzioniInviate } from '@/lib/istruzioni-inviate';
import sql from '@/lib/postgres';

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get('ids') ?? '';
  const ids = idsParam.split(',').filter(Boolean);
  if (ids.length === 0) return NextResponse.json({});

  await ensureAlloggiatiTable();
  const [links, countRows, istruzioni] = await Promise.all([
    leggiLinksPerPrenotazioni(ids),
    sql`SELECT prenotazione_id, COUNT(*)::int AS count,
               COUNT(inviato_portale_at)::int AS inviati,
               MAX(inviato_portale_at) AS ultimo_invio
        FROM alloggiati WHERE prenotazione_id = ANY(${ids}) GROUP BY prenotazione_id`,
    leggiIstruzioniInviate(ids),
  ]);

  const perId = new Map(countRows.map(r => [r.prenotazione_id as string, r]));
  const result: Record<string, {
    linkInviato: boolean; linkCreatedAt: string | null; alloggiatiCount: number;
    /** Schede già accettate da Alloggiati Web (Questura) */
    questuraInviati: number; questuraUltimoInvio: string | null;
    /** Ultima volta che è stato preparato il messaggio WhatsApp con le istruzioni di check-in */
    istruzioniInviateAt: string | null;
  }> = {};
  for (const id of ids) {
    const r = perId.get(id);
    result[id] = {
      linkInviato: !!links[id],
      linkCreatedAt: links[id]?.created_at ?? null,
      alloggiatiCount: Number(r?.count ?? 0),
      questuraInviati: Number(r?.inviati ?? 0),
      questuraUltimoInvio: (r?.ultimo_invio as string | null) ?? null,
      istruzioniInviateAt: istruzioni[id] ?? null,
    };
  }
  return NextResponse.json(result);
}
