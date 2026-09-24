import { NextRequest, NextResponse } from 'next/server';
import { leggiBiancheria, scriviBiancheriaGiorno } from '@/lib/biancheria';
import { BiancheriaStanza, CAPI_BIANCHERIA } from '@/lib/types';

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const n = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));

// GET /api/biancheria?data=YYYY-MM-DD  oppure  ?dal=...&al=...
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const dal = sp.get('data') ?? sp.get('dal') ?? '';
  const al  = sp.get('data') ?? sp.get('al')  ?? dal;
  if (!RE_DATA.test(dal) || !RE_DATA.test(al)) {
    return NextResponse.json({ error: 'Parametri data non validi' }, { status: 400 });
  }
  return NextResponse.json(await leggiBiancheria(dal, al));
}

// PUT { data, righe: [{ camera_id, lenz_sing, lenz_matr, federe, telo_doccia, telo_viso, telo_ospite, tappetini, copriletto, piumone }] }
export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!RE_DATA.test(body.data ?? '') || !Array.isArray(body.righe)) {
    return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });
  }
  const righe = body.righe.map((r: Record<string, unknown>) => {
    const riga: Record<string, unknown> = { data: body.data, camera_id: n(r.camera_id) };
    CAPI_BIANCHERIA.forEach((c) => { riga[c.key] = n(r[c.key]); });
    return riga as BiancheriaStanza;
  });
  await scriviBiancheriaGiorno(body.data, righe);
  return NextResponse.json({ ok: true });
}
