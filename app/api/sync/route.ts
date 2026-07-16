import { NextResponse } from 'next/server';
import { sincronizzaTutti, leggiImpostazioni } from '@/lib/ical';
import { arricchisciPrenotazioniDaSheetsAll } from '@/lib/googlesheets';
import { cookies } from 'next/headers';
import { getStrutturaAttiva } from '@/lib/strutture';

export async function POST() {
  const cookieStore = await cookies();
  const strutturaId = cookieStore.get('struttura_id')?.value;
  const struttura = await getStrutturaAttiva(strutturaId);

  // 1. Import from iCal using struttura's ical_urls (aggiorna/marca cancellate per UID,
  // non cancella mai le prenotazioni esistenti: preserva l'id e il collegamento con l'anagrafica alloggiati)
  const risultatiIcal = await sincronizzaTutti(struttura.ical_urls, struttura.id);

  // 2. Google Sheets sync
  const imp = await leggiImpostazioni();
  const sheetsConfigurato = !!imp.google_sheet_id?.trim();
  let prenotazioniArricchite = 0;
  let righeSkippate: string[] = [];
  let sheetsErrore: string | null = null;
  if (sheetsConfigurato) {
    try {
      const res = await arricchisciPrenotazioniDaSheetsAll(struttura.id);
      prenotazioniArricchite = res.modificate;
      righeSkippate = res.saltate;
    } catch (err) {
      sheetsErrore = err instanceof Error ? err.message : 'Errore sconosciuto';
    }
  }

  return NextResponse.json({ ok: true, risultati: risultatiIcal, prenotazioniArricchite, righeSkippate, sheetsErrore, sheetsConfigurato });
}
