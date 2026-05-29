import { NextRequest, NextResponse } from 'next/server';
import { verificaToken, leggiUtenti } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const payload = verificaToken(token);
  if (!payload) return NextResponse.json({ error: 'Token non valido' }, { status: 401 });

  const utenti = await leggiUtenti();
  const utente = utenti.find((u) => u.username === payload.u);
  if (!utente) return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });

  return NextResponse.json({
    username: utente.username,
    solo_calendario: utente.solo_calendario ?? false,
  });
}
