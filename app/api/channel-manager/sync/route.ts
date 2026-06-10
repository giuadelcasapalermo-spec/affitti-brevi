/**
 * POST /api/channel-manager/sync
 * Importa/aggiorna le prenotazioni dal Booking Channel Manager.
 *
 * Body: { struttura_id: string; stato?: 'new' | 'modified' | 'cancelled' | 'all' }
 * Usa UPSERT basato su id stabile `bk:{struttura_id}:{booking_id}`.
 * Le cancellazioni vengono marcate come 'cancellata' senza eliminare il record.
 */
import { NextRequest, NextResponse } from 'next/server';
import { leggiStruttura } from '@/lib/strutture';
import sql from '@/lib/postgres';
import { randomUUID } from 'crypto';

interface BookingReservation {
  id: string;
  hotelId: string;
  roomId: string;
  status: 'new' | 'modified' | 'cancelled';
  bookedAt: string;
  checkIn: string;
  checkOut: string;
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    adults: number;
    children: number;
    childAges?: number[];
  };
  totalPrice: number;
  currency: string;
  commission: number;
  hotelReceivable: number;
  cityTax: number;
  cityTaxIncluded: boolean;
}

export async function POST(req: NextRequest) {
  const { struttura_id, stato = 'all' } = await req.json() as { struttura_id: string; stato?: string };
  if (!struttura_id) return NextResponse.json({ error: 'struttura_id mancante' }, { status: 400 });

  const struttura = await leggiStruttura(struttura_id);
  if (!struttura) return NextResponse.json({ error: 'Struttura non trovata' }, { status: 404 });

  const cfg = struttura.channel_manager_config;
  if (!cfg?.channel_manager_url) {
    return NextResponse.json({ error: 'Channel Manager non configurato' }, { status: 400 });
  }

  const base = cfg.channel_manager_url.replace(/\/$/, '');
  const qs = stato !== 'all' ? `?status=${stato}` : '';

  let reservations: BookingReservation[];
  try {
    const res = await fetch(`${base}/api/reservations${qs}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { reservations?: BookingReservation[] };
    reservations = data.reservations ?? [];
  } catch (e) {
    return NextResponse.json({ error: `Errore chiamata Channel Manager: ${e}` }, { status: 502 });
  }

  // Reverse-map roomId → camera_id
  const roomToCamera = Object.fromEntries(
    Object.entries(cfg.room_id_map ?? {}).map(([camId, roomId]) => [roomId, Number(camId)])
  );

  let importate = 0, aggiornate = 0, cancellate = 0;
  const errori: string[] = [];

  for (const r of reservations) {
    const prenotazioneId = `bk:${struttura_id}:${r.id}`;
    const camera_id = roomToCamera[r.roomId];

    if (!camera_id) {
      errori.push(`Room ID "${r.roomId}" non mappato — configura il mapping camere`);
      continue;
    }

    const ospite_nome = `${r.guest.firstName} ${r.guest.lastName}`.trim();
    const note = [
      r.guest.adults > 0 && `${r.guest.adults} adulti`,
      r.guest.children > 0 && `${r.guest.children} bambini${r.guest.childAges ? ` (età: ${r.guest.childAges.join(', ')})` : ''}`,
      `Commissione: €${r.commission}`,
      r.cityTax > 0 && `City tax: €${r.cityTax}${r.cityTaxIncluded ? ' (inclusa)' : ''}`,
    ].filter(Boolean).join(' · ');

    const stato_prenotazione = r.status === 'cancelled' ? 'cancellata' : 'confermata';
    const now = new Date().toISOString();

    try {
      const existing = await sql`SELECT id FROM prenotazioni WHERE id = ${prenotazioneId}`;

      if (existing.length > 0) {
        await sql`
          UPDATE prenotazioni SET
            camera_id = ${camera_id},
            ospite_nome = ${ospite_nome},
            ospite_email = ${r.guest.email || ''},
            ospite_telefono = ${r.guest.phone || ''},
            check_in = ${r.checkIn},
            check_out = ${r.checkOut},
            importo_totale = ${r.totalPrice},
            stato = ${stato_prenotazione},
            note = ${note},
            fonte = 'booking'
          WHERE id = ${prenotazioneId}
        `;
        if (r.status === 'cancelled') cancellate++; else aggiornate++;
      } else {
        await sql`
          INSERT INTO prenotazioni
            (id, struttura_id, camera_id, ospite_nome, ospite_email, ospite_telefono,
             check_in, check_out, importo_totale, tassa_soggiorno, stato, note, created_at, fonte, ical_uid)
          VALUES
            (${prenotazioneId}, ${struttura_id}, ${camera_id}, ${ospite_nome},
             ${r.guest.email || ''}, ${r.guest.phone || ''},
             ${r.checkIn}, ${r.checkOut}, ${r.totalPrice},
             ${r.cityTaxIncluded ? 0 : r.cityTax},
             ${stato_prenotazione}, ${note}, ${now}, 'booking', ${r.id})
        `;
        if (r.status === 'cancelled') cancellate++; else importate++;
      }
    } catch (e) {
      errori.push(`${r.id}: ${e}`);
    }
  }

  return NextResponse.json({
    ok: true,
    totale: reservations.length,
    importate,
    aggiornate,
    cancellate,
    errori,
  });
}
