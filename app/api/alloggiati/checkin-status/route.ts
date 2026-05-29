import { NextRequest, NextResponse } from 'next/server';
import { leggiLinksPerPrenotazioni } from '@/lib/link-alloggiati';
import sql from '@/lib/postgres';

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get('ids') ?? '';
  const ids = idsParam.split(',').filter(Boolean);
  if (ids.length === 0) return NextResponse.json({});

  const [links, countRows] = await Promise.all([
    leggiLinksPerPrenotazioni(ids),
    sql`SELECT prenotazione_id, COUNT(*)::int as count FROM alloggiati WHERE prenotazione_id = ANY(${ids}) GROUP BY prenotazione_id`,
  ]);

  const counts: Record<string, number> = {};
  for (const row of countRows) {
    counts[row.prenotazione_id as string] = Number(row.count);
  }

  const result: Record<string, { linkInviato: boolean; linkCreatedAt: string | null; alloggiatiCount: number }> = {};
  for (const id of ids) {
    result[id] = {
      linkInviato: !!links[id],
      linkCreatedAt: links[id]?.created_at ?? null,
      alloggiatiCount: counts[id] ?? 0,
    };
  }
  return NextResponse.json(result);
}
