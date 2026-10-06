import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/postgres';

// Stato della configurazione guidata. 'da_fare' è impostato da scripts/init-istanza.mjs
// sulle istanze nuove; le istanze esistenti non hanno la riga e non vengono reindirizzate.

export async function GET() {
  const rows = await sql`SELECT valore FROM impostazioni WHERE tipo = 'config' AND chiave = 'setup_wizard'`;
  return NextResponse.json({ da_fare: rows[0]?.valore === 'da_fare' });
}

export async function POST(req: NextRequest) {
  const { completata } = await req.json();
  const valore = completata ? 'fatto' : 'da_fare';
  await sql`
    INSERT INTO impostazioni (tipo, chiave, valore) VALUES ('config', 'setup_wizard', ${valore})
    ON CONFLICT (tipo, chiave) DO UPDATE SET valore = EXCLUDED.valore
  `;
  return NextResponse.json({ ok: true });
}
