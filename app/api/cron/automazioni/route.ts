/**
 * GET /api/cron/automazioni — invii automatici del check-in (vedi lib/automazioni.ts).
 *
 * Vercel Cron la chiama due volte per ogni orario (vercel.json, in UTC, ora solare e legale), con una voce
 * giornaliera per ciascuna (il piano Hobby ammette solo cron giornalieri; il parametro ?utc= li distingue):
 * agisce solo quando l'ora italiana è quella prevista, così gli orari restano giusti tutto l'anno.
 *   14:00 → schedine Alloggiati Web, primo tentativo (nessun avviso)
 *   21:00 → schedine Alloggiati Web, tentativo finale (avvisi alla struttura)
 *
 * Prova manuale: ?azione=portale | portale_finale (stessa autorizzazione).
 * Protetto da CRON_SECRET (Authorization: Bearer <secret>).
 */
import { NextRequest, NextResponse } from 'next/server';
import { inviaPortaleAutomatico, oraItalia, type Esito } from '@/lib/automazioni';

export const preferredRegion = 'fra1'; // Il portale PS blocca IP USA — usa Francoforte (EU)
export const maxDuration = 300;

const ORARI: Record<number, 'portale' | 'portale_finale'> = { 14: 'portale', 21: 'portale_finale' };

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const ora = oraItalia();
  const azione = req.nextUrl.searchParams.get('azione') ?? ORARI[ora];
  if (!azione) return NextResponse.json({ ok: true, ora, azione: null, messaggio: 'Nessuna automazione a quest\'ora' });

  let esiti: Esito[];
  if (azione === 'portale' || azione === 'portale_finale') esiti = await inviaPortaleAutomatico(azione === 'portale_finale');
  else return NextResponse.json({ ok: false, errore: `Azione sconosciuta: ${azione}` }, { status: 400 });

  const errori = esiti.filter(e => e.esito === 'errore');
  console.log(`[automazioni] ${azione} (ora ${ora}): ${esiti.length} esiti, ${errori.length} errori`, JSON.stringify(esiti));
  return NextResponse.json({ ok: true, ora, azione, esiti });
}
