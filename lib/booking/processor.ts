import { randomUUID } from 'crypto';
import {
  ensureAvailabilityTable,
  getPool,
  bloccaDateTx,
  liberaDateTx,
  dateRange,
} from '@/lib/booking/availability';
import { pushARI } from '@/lib/ari/push';
import { retry } from '@/lib/retry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BookingReservation {
  id: string;
  room_id?: number;
  checkin?: string;
  checkout?: string;
  guest?: { name?: string; email?: string; phone?: string };
  total_price?: number;
}

export interface BookingEvent {
  event_id: string;
  type: 'reservation.new' | 'reservation.modify' | 'reservation.cancel';
  reservation: BookingReservation;
}

// ---------------------------------------------------------------------------
// webhook_events table helpers
// ---------------------------------------------------------------------------

let _webhookTableReady = false;

async function ensureWebhookEventsTable(): Promise<void> {
  if (_webhookTableReady) return;
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id TEXT PRIMARY KEY,
        tipo TEXT NOT NULL,
        payload TEXT NOT NULL,
        processato BOOLEAN DEFAULT false,
        errore TEXT,
        created_at TEXT NOT NULL
      )
    `);
    _webhookTableReady = true;
  } finally {
    client.release();
  }
}

export async function eventExists(eventId: string): Promise<boolean> {
  await ensureWebhookEventsTable();
  const client = await getPool().connect();
  try {
    const res = await client.query('SELECT id FROM webhook_events WHERE id = $1', [eventId]);
    return res.rows.length > 0;
  } finally {
    client.release();
  }
}

export async function saveEvent(
  eventId: string,
  tipo: string,
  payload: unknown
): Promise<void> {
  await ensureWebhookEventsTable();
  const client = await getPool().connect();
  try {
    await client.query(
      `INSERT INTO webhook_events (id, tipo, payload, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [eventId, tipo, JSON.stringify(payload), new Date().toISOString()]
    );
  } finally {
    client.release();
  }
}

export async function markEventProcessed(eventId: string): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('UPDATE webhook_events SET processato = true WHERE id = $1', [eventId]);
  } finally {
    client.release();
  }
}

export async function markEventError(eventId: string, errore: string): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('UPDATE webhook_events SET errore = $1 WHERE id = $2', [errore, eventId]);
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// camera_id resolution
// ---------------------------------------------------------------------------

function resolveCameraId(roomId?: number): number {
  if (roomId === undefined || roomId === null) return 1;
  return Math.max(1, Math.min(5, Math.round(roomId)));
}

// ---------------------------------------------------------------------------
// Event handlers — each uses a single Pool transaction for atomicity:
//   bloccaDate/liberaDate + INSERT/UPDATE prenotazione in one BEGIN/COMMIT
// ---------------------------------------------------------------------------

async function handleNew(event: BookingEvent): Promise<void> {
  const res = event.reservation;
  const cameraId = resolveCameraId(res.room_id);
  const checkIn = res.checkin ?? '';
  const checkOut = res.checkout ?? '';
  if (!checkIn || !checkOut) throw new Error('reservation.new: missing checkin/checkout');

  await ensureAvailabilityTable();

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    // Idempotency: skip if ical_uid already exists
    const dup = await client.query(
      'SELECT id FROM prenotazioni WHERE ical_uid = $1',
      [res.id]
    );
    if (dup.rows.length === 0) {
      // Overbooking check + block dates (atomic with the INSERT below)
      await bloccaDateTx(client, cameraId, checkIn, checkOut);

      await client.query(
        `INSERT INTO prenotazioni
           (id, camera_id, ospite_nome, ospite_telefono, ospite_email,
            check_in, check_out, importo_totale, stato, note, created_at, fonte, ical_uid)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'confermata',$9,$10,'ical',$11)`,
        [
          randomUUID(), cameraId,
          res.guest?.name ?? 'Ospite Booking.com',
          res.guest?.phone ?? '',
          res.guest?.email ?? '',
          checkIn, checkOut,
          res.total_price ?? 0,
          'Prenotazione Booking.com',
          new Date().toISOString(),
          res.id,
        ]
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }

  const dates = dateRange(checkIn, checkOut);
  await retry(() => pushARI(cameraId, dates, false, res.total_price), 3);
}

async function handleModify(event: BookingEvent): Promise<void> {
  const res = event.reservation;
  const cameraId = resolveCameraId(res.room_id);
  const newCheckIn = res.checkin ?? '';
  const newCheckOut = res.checkout ?? '';

  await ensureAvailabilityTable();

  let oldDates: string[] = [];
  let newDates: string[] = [];
  let oldCameraId = cameraId;

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id, camera_id, check_in, check_out, importo_totale FROM prenotazioni WHERE ical_uid = $1',
      [res.id]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      oldCameraId = row.camera_id;
      const oldCheckIn: string = row.check_in;
      const oldCheckOut: string = row.check_out;

      // Free old dates, then block new ones — both in the same transaction
      if (oldCheckIn && oldCheckOut) {
        await liberaDateTx(client, oldCameraId, oldCheckIn, oldCheckOut);
        oldDates = dateRange(oldCheckIn, oldCheckOut);
      }

      if (newCheckIn && newCheckOut) {
        await bloccaDateTx(client, cameraId, newCheckIn, newCheckOut);
        newDates = dateRange(newCheckIn, newCheckOut);
      }

      await client.query(
        `UPDATE prenotazioni
         SET camera_id=$1, check_in=$2, check_out=$3, importo_totale=$4
         WHERE ical_uid=$5`,
        [cameraId, newCheckIn, newCheckOut, res.total_price ?? row.importo_totale, res.id]
      );
    } else {
      // Not found locally — treat as new
      if (newCheckIn && newCheckOut) {
        await bloccaDateTx(client, cameraId, newCheckIn, newCheckOut);
        newDates = dateRange(newCheckIn, newCheckOut);
      }

      await client.query(
        `INSERT INTO prenotazioni
           (id, camera_id, ospite_nome, ospite_telefono, ospite_email,
            check_in, check_out, importo_totale, stato, note, created_at, fonte, ical_uid)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'confermata',$9,$10,'ical',$11)`,
        [
          randomUUID(), cameraId,
          res.guest?.name ?? 'Ospite Booking.com',
          res.guest?.phone ?? '',
          res.guest?.email ?? '',
          newCheckIn, newCheckOut,
          res.total_price ?? 0,
          'Prenotazione Booking.com (modificata)',
          new Date().toISOString(),
          res.id,
        ]
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }

  // ARI push outside the transaction
  if (oldDates.length > 0) {
    await retry(() => pushARI(oldCameraId, oldDates, true), 3);
  }
  if (newDates.length > 0) {
    await retry(() => pushARI(cameraId, newDates, false, res.total_price), 3);
  }
}

async function handleCancel(event: BookingEvent): Promise<void> {
  const res = event.reservation;

  let ari: { cameraId: number; dates: string[] } | undefined;

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id, camera_id, check_in, check_out FROM prenotazioni WHERE ical_uid = $1',
      [res.id]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      const cameraId: number = row.camera_id;
      const checkIn: string = row.check_in;
      const checkOut: string = row.check_out;

      await liberaDateTx(client, cameraId, checkIn, checkOut);
      await client.query(
        "UPDATE prenotazioni SET stato = 'cancellata' WHERE ical_uid = $1",
        [res.id]
      );

      ari = { cameraId, dates: dateRange(checkIn, checkOut) };
    }

    await client.query('COMMIT');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }

  if (ari) {
    await retry(() => pushARI(ari!.cameraId, ari!.dates, true), 3);
  }
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

export async function processEvent(event: BookingEvent): Promise<void> {
  switch (event.type) {
    case 'reservation.new':
      await handleNew(event);
      break;
    case 'reservation.modify':
      await handleModify(event);
      break;
    case 'reservation.cancel':
      await handleCancel(event);
      break;
    default: {
      const _exhaustive: never = event.type;
      console.warn(`[booking/processor] Unknown event type: ${_exhaustive}`);
    }
  }
}
