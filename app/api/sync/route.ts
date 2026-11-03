import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStrutturaAttiva } from '@/lib/strutture';
import { eseguiSyncStruttura } from '@/lib/sync';

export const maxDuration = 300;

export async function POST() {
  const cookieStore = await cookies();
  const strutturaId = cookieStore.get('struttura_id')?.value;
  const struttura = await getStrutturaAttiva(strutturaId);
  return NextResponse.json(await eseguiSyncStruttura(struttura));
}
