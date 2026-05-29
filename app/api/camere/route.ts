import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStrutturaAttiva } from '@/lib/strutture';
import { Camera } from '@/lib/types';

const DEFAULT_PREZZI: Record<number, number> = { 1: 60, 2: 60, 3: 65, 4: 65, 5: 70 };

export async function GET() {
  const cookieStore = await cookies();
  const strutturaId = cookieStore.get('struttura_id')?.value;
  const struttura = await getStrutturaAttiva(strutturaId);
  const camere: Camera[] = [];
  for (let i = 1; i <= struttura.num_camere; i++) {
    camere.push({
      id: i,
      nome: struttura.nomi_camere[i] ?? `Camera ${i}`,
      prezzo_notte: struttura.prezzi_camere[i] ?? DEFAULT_PREZZI[i] ?? 60,
      colore: struttura.colori_camere[i],
    });
  }
  return NextResponse.json(camere);
}
