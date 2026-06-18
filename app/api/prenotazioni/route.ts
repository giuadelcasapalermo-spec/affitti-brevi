import { NextRequest, NextResponse } from 'next/server';
import { Prenotazione } from '@/lib/types';
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { getStrutturaAttiva } from '@/lib/strutture';
import sql from '@/lib/postgres';

export async function GET() {
  const cookieStore = await cookies();
  const strutturaId = cookieStore.get('struttura_id')?.value;
  const struttura = await getStrutturaAttiva(strutturaId);
  const rows = await sql`
    SELECT id, struttura_id, camera_id, ospite_nome, ospite_telefono, ospite_email,
           check_in, check_out, importo_totale, tassa_soggiorno,
           stato, note, created_at, fonte, ical_uid
    FROM prenotazioni WHERE struttura_id = ${struttura.id} ORDER BY check_in DESC
  `;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const cookieStore = await cookies();
  const strutturaId = cookieStore.get('struttura_id')?.value;
  const struttura = await getStrutturaAttiva(strutturaId);

  const nuova: Prenotazione = {
    id: body.id || randomUUID(),
    struttura_id: struttura.id,
    camera_id: body.camera_id,
    ospite_nome: body.ospite_nome,
    ospite_telefono: body.ospite_telefono ?? '',
    ospite_email: body.ospite_email ?? '',
    check_in: body.check_in,
    check_out: body.check_out,
    importo_totale: body.importo_totale,
    tassa_soggiorno: body.tassa_soggiorno ? Number(body.tassa_soggiorno) : undefined,
    stato: body.stato ?? 'confermata',
    note: body.note ?? '',
    created_at: new Date().toISOString(),
    fonte: 'manuale',
  };

  await sql`
    INSERT INTO prenotazioni
      (id, struttura_id, camera_id, ospite_nome, ospite_telefono, ospite_email,
       check_in, check_out, importo_totale, tassa_soggiorno, stato, note, created_at, fonte, ical_uid)
    VALUES
      (${nuova.id}, ${nuova.struttura_id}, ${nuova.camera_id}, ${nuova.ospite_nome},
       ${nuova.ospite_telefono}, ${nuova.ospite_email}, ${nuova.check_in}, ${nuova.check_out},
       ${nuova.importo_totale}, ${nuova.tassa_soggiorno ?? null}, ${nuova.stato},
       ${nuova.note}, ${nuova.created_at}, ${nuova.fonte}, ${nuova.ical_uid ?? null})
  `;
  return NextResponse.json(nuova, { status: 201 });
}
