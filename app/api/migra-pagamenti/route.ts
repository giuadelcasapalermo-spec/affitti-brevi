import { NextResponse } from 'next/server';
import sql from '@/lib/postgres';

export async function POST() {
  // Assicura colonne esistano
  await sql`ALTER TABLE uscite ADD COLUMN IF NOT EXISTS fonte_pagamento TEXT NOT NULL DEFAULT 'Contanti'`;
  await sql`ALTER TABLE entrate ADD COLUMN IF NOT EXISTS fonte_pagamento TEXT NOT NULL DEFAULT 'Contanti'`;

  // Tutti i movimenti senza fonte → Contanti
  const u = await sql`UPDATE uscite SET fonte_pagamento = 'Contanti' WHERE fonte_pagamento IS NULL OR fonte_pagamento = '' RETURNING id`;
  const e = await sql`UPDATE entrate SET fonte_pagamento = 'Contanti' WHERE fonte_pagamento IS NULL OR fonte_pagamento = '' RETURNING id`;

  // Entrate Booking.com → Unicredit
  const b = await sql`UPDATE entrate SET fonte_pagamento = 'Unicredit' WHERE categoria = 'Booking.com' RETURNING id`;

  return NextResponse.json({
    ok: true,
    uscite_aggiornate: u.length,
    entrate_aggiornate: e.length,
    booking_unicredit: b.length,
  });
}
