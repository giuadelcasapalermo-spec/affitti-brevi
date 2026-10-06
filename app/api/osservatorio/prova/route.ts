import { NextRequest, NextResponse } from 'next/server';
import { provaCredenziali } from '@/lib/osservatorio';

export const preferredRegion = 'fra1';

// POST { utente, password, codice_struttura } — prova l'accesso alle WebAPI dell'Osservatorio (solo login/logout)
export async function POST(req: NextRequest) {
  const { utente, password, codice_struttura } = await req.json();
  if (!utente || !password) return NextResponse.json({ ok: false, errore: 'Inserisci utente e password' }, { status: 400 });
  try {
    await provaCredenziali({ utente, password, codice_struttura: codice_struttura ?? '' });
    return NextResponse.json({ ok: true, messaggio: 'Accesso riuscito' });
  } catch (e) {
    return NextResponse.json({ ok: false, errore: e instanceof Error ? e.message : String(e) });
  }
}
