import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/postgres';

// GET /api/backup — scarica tutto il DB come JSON
export async function GET() {
  try {
    const [prenotazioni, uscite, entrate] = await Promise.all([
      sql`SELECT * FROM prenotazioni ORDER BY check_in DESC`,
      sql`SELECT * FROM uscite ORDER BY data DESC`,
      sql`SELECT * FROM entrate ORDER BY data DESC`,
    ]);

    const backup = {
      version: 1,
      timestamp: new Date().toISOString(),
      prenotazioni,
      uscite,
      entrate,
    };

    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="backup-affitti-${new Date().toISOString().slice(0,10)}.json"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Errore';
    return NextResponse.json({ ok: false, errore: msg }, { status: 500 });
  }
}

// POST /api/backup — ripristina da un JSON di backup
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.version !== 1 || !body.prenotazioni || !body.uscite || !body.entrate) {
      return NextResponse.json({ ok: false, errore: 'File di backup non valido' }, { status: 400 });
    }

    const { prenotazioni, uscite, entrate } = body;

    // Ripristina prenotazioni
    await sql`DELETE FROM prenotazioni`;
    for (const p of prenotazioni) {
      await sql`
        INSERT INTO prenotazioni (id, camera_id, ospite_nome, ospite_telefono, ospite_email,
          check_in, check_out, importo_totale, tassa_soggiorno, stato, note, created_at, fonte, ical_uid)
        VALUES (
          ${p.id}, ${p.camera_id}, ${p.ospite_nome}, ${p.ospite_telefono ?? ''}, ${p.ospite_email ?? ''},
          ${p.check_in}, ${p.check_out}, ${p.importo_totale}, ${p.tassa_soggiorno ?? null},
          ${p.stato}, ${p.note ?? ''}, ${p.created_at}, ${p.fonte ?? 'manuale'}, ${p.ical_uid ?? null}
        )
        ON CONFLICT (id) DO UPDATE SET
          camera_id = EXCLUDED.camera_id, ospite_nome = EXCLUDED.ospite_nome,
          check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out,
          importo_totale = EXCLUDED.importo_totale, tassa_soggiorno = EXCLUDED.tassa_soggiorno,
          stato = EXCLUDED.stato, note = EXCLUDED.note, fonte = EXCLUDED.fonte, ical_uid = EXCLUDED.ical_uid
      `;
    }

    // Ripristina uscite
    await sql`DELETE FROM uscite`;
    for (const u of uscite) {
      await sql`
        INSERT INTO uscite (id, data, descrizione, categoria, importo, camera_id, note, created_at)
        VALUES (${u.id}, ${u.data}, ${u.descrizione}, ${u.categoria}, ${u.importo},
                ${u.camera_id ?? null}, ${u.note ?? ''}, ${u.created_at})
        ON CONFLICT (id) DO UPDATE SET
          data = EXCLUDED.data, descrizione = EXCLUDED.descrizione, categoria = EXCLUDED.categoria,
          importo = EXCLUDED.importo, camera_id = EXCLUDED.camera_id, note = EXCLUDED.note
      `;
    }

    // Ripristina entrate
    await sql`DELETE FROM entrate`;
    for (const e of entrate) {
      await sql`
        INSERT INTO entrate (id, data, descrizione, categoria, importo, camera_id, note, created_at)
        VALUES (${e.id}, ${e.data}, ${e.descrizione}, ${e.categoria}, ${e.importo},
                ${e.camera_id ?? null}, ${e.note ?? ''}, ${e.created_at})
        ON CONFLICT (id) DO UPDATE SET
          data = EXCLUDED.data, descrizione = EXCLUDED.descrizione, categoria = EXCLUDED.categoria,
          importo = EXCLUDED.importo, camera_id = EXCLUDED.camera_id, note = EXCLUDED.note
      `;
    }

    return NextResponse.json({
      ok: true,
      messaggio: `Ripristino completato: ${prenotazioni.length} prenotazioni, ${uscite.length} uscite, ${entrate.length} entrate`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Errore';
    return NextResponse.json({ ok: false, errore: msg }, { status: 500 });
  }
}
