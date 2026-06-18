/**
 * GET /api/cron/sync
 *
 * Eseguito da Vercel Cron (e da cron-job.org ogni 5 minuti).
 * Sincronizza le prenotazioni da Booking.com per tutte le strutture
 * che hanno channel_manager_config configurato.
 *
 * Protetto da CRON_SECRET (Authorization: Bearer <secret>).
 */
import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/postgres';
import { BookingChannelManagerConfig } from '@/lib/types';

interface BookingReservation {
  id: string;
  roomId: string;
  status: 'new' | 'modified' | 'cancelled';
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  commission: number;
  cityTax: number;
  cityTaxIncluded: boolean;
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    adults: number;
    children: number;
    childAges?: number[];
  };
}

async function syncStruttura(strutturaId: string, cfg: BookingChannelManagerConfig): Promise<{
  importate: number; aggiornate: number; cancellate: number; errori: string[];
}> {
  const base = cfg.channel_manager_url.replace(/\/$/, '');

  const res = await fetch(`${base}/api/reservations`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Channel Manager HTTP ${res.status}`);
  const data = await res.json() as { reservations?: BookingReservation[] };
  const reservations = data.reservations ?? [];

  const roomToCamera = Object.fromEntries(
    Object.entries(cfg.room_id_map ?? {}).map(([camId, roomId]) => [roomId, Number(camId)])
  );

  let importate = 0, aggiornate = 0, cancellate = 0;
  const errori: string[] = [];

  for (const r of reservations) {
    const prenotazioneId = `bk:${strutturaId}:${r.id}`;
    const camera_id = roomToCamera[r.roomId];
    if (!camera_id) {
      errori.push(`Room ID "${r.roomId}" non mappato`);
      continue;
    }

    const ospite_nome = `${r.guest.firstName} ${r.guest.lastName}`.trim();
    const note = [
      r.guest.adults > 0 && `${r.guest.adults} adulti`,
      r.guest.children > 0 && `${r.guest.children} bambini${r.guest.childAges ? ` (età: ${r.guest.childAges.join(', ')})` : ''}`,
      `Commissione: €${r.commission}`,
      r.cityTax > 0 && `City tax: €${r.cityTax}${r.cityTaxIncluded ? ' (inclusa)' : ''}`,
    ].filter(Boolean).join(' · ');

    const stato = r.status === 'cancelled' ? 'cancellata' : 'confermata';
    const now = new Date().toISOString();

    try {
      const existing = await sql`SELECT id FROM prenotazioni WHERE id = ${prenotazioneId}`;
      if (existing.length > 0) {
        await sql`
          UPDATE prenotazioni SET
            camera_id = ${camera_id}, ospite_nome = ${ospite_nome},
            ospite_email = ${r.guest.email || ''}, ospite_telefono = ${r.guest.phone || ''},
            check_in = ${r.checkIn}, check_out = ${r.checkOut},
            importo_totale = ${r.totalPrice}, stato = ${stato}, note = ${note}, fonte = 'booking'
          WHERE id = ${prenotazioneId}
        `;
        if (r.status === 'cancelled') cancellate++; else aggiornate++;
      } else {
        await sql`
          INSERT INTO prenotazioni
            (id, struttura_id, camera_id, ospite_nome, ospite_email, ospite_telefono,
             check_in, check_out, importo_totale, tassa_soggiorno, stato, note, created_at, fonte, ical_uid)
          VALUES
            (${prenotazioneId}, ${strutturaId}, ${camera_id}, ${ospite_nome},
             ${r.guest.email || ''}, ${r.guest.phone || ''},
             ${r.checkIn}, ${r.checkOut}, ${r.totalPrice},
             ${r.cityTaxIncluded ? 0 : r.cityTax},
             ${stato}, ${note}, ${now}, 'booking', ${r.id})
        `;
        if (r.status === 'cancelled') cancellate++; else importate++;
      }
    } catch (e) {
      errori.push(`${r.id}: ${e}`);
    }
  }

  return { importate, aggiornate, cancellate, errori };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }

  // Carica tutte le strutture con channel_manager_config configurato
  const rows = await sql`
    SELECT id, channel_manager_config
    FROM strutture
    WHERE channel_manager_config IS NOT NULL
      AND channel_manager_config->>'channel_manager_url' IS NOT NULL
      AND channel_manager_config->>'channel_manager_url' != ''
  `;

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, message: 'Nessuna struttura con Channel Manager configurato', strutture: 0 });
  }

  const risultati: Record<string, unknown> = {};
  let totaleImportate = 0, totaleAggiornate = 0, totaleCancellate = 0;

  for (const row of rows) {
    const strutturaId = row.id as string;
    const cfg = row.channel_manager_config as BookingChannelManagerConfig;
    try {
      const r = await syncStruttura(strutturaId, cfg);
      risultati[strutturaId] = r;
      totaleImportate += r.importate;
      totaleAggiornate += r.aggiornate;
      totaleCancellate += r.cancellate;
    } catch (e) {
      risultati[strutturaId] = { errore: e instanceof Error ? e.message : String(e) };
    }
  }

  return NextResponse.json({
    ok: true,
    strutture: rows.length,
    totaleImportate,
    totaleAggiornate,
    totaleCancellate,
    risultati,
    syncAt: new Date().toISOString(),
  });
}
