/**
 * POST /api/channel-manager/test
 * Testa la connessione al Booking Channel Manager per una struttura.
 *
 * Body: { struttura_id: string }
 * Response: { ok: boolean; message: string; pendingCount?: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { leggiStruttura } from '@/lib/strutture';

export async function POST(req: NextRequest) {
  const { struttura_id } = await req.json();
  if (!struttura_id) return NextResponse.json({ ok: false, message: 'struttura_id mancante' }, { status: 400 });

  const struttura = await leggiStruttura(struttura_id);
  if (!struttura) return NextResponse.json({ ok: false, message: 'Struttura non trovata' }, { status: 404 });

  const cfg = struttura.channel_manager_config;
  if (!cfg?.channel_manager_url) {
    return NextResponse.json({ ok: false, message: 'Channel Manager non configurato — imposta prima URL e credenziali' });
  }

  const base = cfg.channel_manager_url.replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/api/reservations`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, message: `Channel Manager risponde con HTTP ${res.status}` });
    }

    const data = await res.json() as { total?: number; pollState?: { lastPollAt: string | null } };
    const pendingCount = data.total ?? 0;
    const lastPoll = data.pollState?.lastPollAt
      ? new Date(data.pollState.lastPollAt).toLocaleString('it-IT')
      : 'mai';

    return NextResponse.json({
      ok: true,
      message: `Connesso — ${pendingCount} prenotazioni in store, ultimo poll: ${lastPoll}`,
      pendingCount,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      ok: false,
      message: `Impossibile raggiungere il Channel Manager: ${msg}`,
    });
  }
}
