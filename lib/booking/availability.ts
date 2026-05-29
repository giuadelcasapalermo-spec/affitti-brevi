import { Pool, PoolClient } from '@neondatabase/serverless';
import { eachDayOfInterval, parseISO, addDays } from 'date-fns';

let _pool: Pool | undefined;

export function getPool(): Pool {
  if (!_pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL non configurato');
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

export function dateRange(checkIn: string, checkOut: string): string[] {
  const start = parseISO(checkIn);
  const end = parseISO(checkOut);
  if (start >= end) return [];
  const days = eachDayOfInterval({ start, end: addDays(end, -1) });
  return days.map(d => d.toISOString().slice(0, 10));
}

let _availabilityTableReady = false;

export async function ensureAvailabilityTable(): Promise<void> {
  if (_availabilityTableReady) return;
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS availability (
        camera_id INT NOT NULL,
        data TEXT NOT NULL,
        disponibile BOOLEAN DEFAULT true,
        prezzo REAL,
        PRIMARY KEY (camera_id, data)
      )
    `);
    _availabilityTableReady = true;
  } finally {
    client.release();
  }
}

// --- Transaction-aware variants (use within an existing BEGIN/COMMIT block) ---

export async function bloccaDateTx(
  client: PoolClient,
  cameraId: number,
  checkIn: string,
  checkOut: string
): Promise<void> {
  const dates = dateRange(checkIn, checkOut);
  if (dates.length === 0) return;

  for (const data of dates) {
    const result = await client.query(
      'SELECT disponibile FROM availability WHERE camera_id = $1 AND data = $2 FOR UPDATE',
      [cameraId, data]
    );

    if (result.rows.length > 0 && !result.rows[0].disponibile) {
      throw new Error(`OVERBOOKING: camera ${cameraId} non disponibile in data ${data}`);
    }

    await client.query(
      `INSERT INTO availability (camera_id, data, disponibile)
       VALUES ($1, $2, false)
       ON CONFLICT (camera_id, data) DO UPDATE SET disponibile = false`,
      [cameraId, data]
    );
  }
}

export async function liberaDateTx(
  client: PoolClient,
  cameraId: number,
  checkIn: string,
  checkOut: string
): Promise<void> {
  const dates = dateRange(checkIn, checkOut);
  if (dates.length === 0) return;

  for (const data of dates) {
    await client.query(
      'UPDATE availability SET disponibile = true WHERE camera_id = $1 AND data = $2',
      [cameraId, data]
    );
  }
}

// --- Standalone wrappers (own transaction, for callers outside processor.ts) ---

export async function bloccaDate(
  cameraId: number,
  checkIn: string,
  checkOut: string
): Promise<void> {
  await ensureAvailabilityTable();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await bloccaDateTx(client, cameraId, checkIn, checkOut);
    await client.query('COMMIT');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}

export async function liberaDate(
  cameraId: number,
  checkIn: string,
  checkOut: string
): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await liberaDateTx(client, cameraId, checkIn, checkOut);
    await client.query('COMMIT');
  } finally {
    client.release();
  }
}
