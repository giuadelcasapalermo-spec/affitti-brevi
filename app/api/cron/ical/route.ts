/**
 * GET /api/cron/ical — Vercel Cron, una volta al giorno (05 UTC: il piano Hobby non permette di più).
 *
 * Stesso sync del pulsante "Sync iCal" per tutte le strutture con almeno un feed. Serve anche ad
 * accorgersi in tempo delle cancellazioni: se un soggiorno con UID ignorato sparisce dal feed e le
 * stesse notti vengono riprenotate (stesso UID), solo un sync fatto in mezzo vede la sparizione e
 * rende di nuovo importabile l'UID.
 *
 * Protetto da CRON_SECRET (Authorization: Bearer <secret>).
 */
import { NextRequest, NextResponse } from 'next/server';
import { leggiStrutture } from '@/lib/strutture';
import { eseguiSyncStruttura } from '@/lib/sync';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const esiti: Record<string, unknown> = {};
  for (const s of await leggiStrutture()) {
    const conFeed = [...Object.values(s.ical_urls ?? {}), ...Object.values(s.ical_urls_airbnb ?? {})]
      .some((u) => String(u ?? '').trim());
    if (!conFeed) continue;
    try {
      const r = await eseguiSyncStruttura(s);
      esiti[s.nome] = {
        aggiunte: r.risultati.reduce((t, x) => t + x.aggiunte, 0),
        avvisi: r.risultati.reduce((t, x) => t + (x.avvisi?.length ?? 0), 0),
        errori: r.risultati.filter((x) => x.errore).map((x) => `camera ${x.camera_id}: ${x.errore}`),
        sheetsErrore: r.sheetsErrore,
      };
    } catch (e) {
      esiti[s.nome] = { errore: e instanceof Error ? e.message : String(e) };
    }
  }

  return NextResponse.json({ ok: true, esiti, syncAt: new Date().toISOString() });
}
