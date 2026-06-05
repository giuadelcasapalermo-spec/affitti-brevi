import { NextResponse } from 'next/server';
import { leggiPrenotazioni, scriviPrenotazioni } from '@/lib/db';
import * as XLSX from 'xlsx';
import { randomUUID } from 'crypto';

export const maxDuration = 30;

const STANZA_ID: Record<string, number> = {
  rossa:  1, 'camera 1': 1, '1': 1,
  gialla: 2, giallla: 2, giall: 2, 'camera 2': 2, '2': 2,
  verde:  3, 'camera 3': 3, '3': 3,
  bianca: 4, 'camera 4': 4, '4': 4,
  blue:   5, blu: 5, 'camera 5': 5, '5': 5,
};

function parseImporto(val: unknown): number {
  const s = String(val ?? '').replace(/[€\s]/g, '').replace(',', '.');
  return parseFloat(s) || 0;
}

function excelToISO(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'number' && val > 10000) {
    return new Date((val - 25569) * 86400 * 1000).toISOString().split('T')[0];
  }
  const m = String(val).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

function getEmailCol(headerRow: unknown[]): number {
  return headerRow.findIndex(cell => String(cell ?? '').toLowerCase().trim() === 'email');
}

function getCols(headerRow: unknown[], emailCol: number): Record<string, number> {
  const shift = (emailCol >= 0 && emailCol <= 2) ? 1 : 0;
  const isOld = headerRow.length <= (12 + shift) || String(headerRow[5 + shift] ?? '').toLowerCase().includes('ferrott');
  if (isOld) return { tip: 0, des: 1, ent: 3 + shift, di: 6 + shift, df: 7 + shift, sta: 9 + shift, tax: -1 };
  return { tip: 0, des: 1, ent: 3 + shift, tax: 5 + shift, di: 10 + shift, df: 11 + shift, sta: 13 + shift };
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, errore: 'FormData mancante' }, { status: 400 });

  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ ok: false, errore: 'File mancante' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: 'buffer' });

  type RigaExcel = {
    cameraId: number;
    checkIn: string;
    checkOut: string;
    nome: string;
    importo: number;
    tassa: number;
    tipo: 'booking' | 'privato';
    email: string;
  };
  const righe: RigaExcel[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
    const headerIdx = rows.findIndex(r => String((r as unknown[])[0]).trim() === 'Tipologia');
    if (headerIdx < 0) continue;
    const emailCol = getEmailCol(rows[headerIdx] as unknown[]);
    const C = getCols(rows[headerIdx] as unknown[], emailCol);

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      const tipo = String(row[C.tip] ?? '').trim().toLowerCase();
      const isBooking = tipo === 'ricavo booking';
      const isPrivato = tipo === 'privato' || tipo === 'ricavo privato';
      if (!isBooking && !isPrivato) continue;

      const nome     = String(row[C.des] ?? '').trim();
      const importo  = parseImporto(row[C.ent]);
      const tassa    = C.tax >= 0 ? parseImporto(row[C.tax]) : 0;
      const checkIn  = excelToISO(row[C.di]);
      const checkOut = excelToISO(row[C.df]);
      const stanza   = String(row[C.sta] ?? '').trim().toLowerCase();
      const cameraId = STANZA_ID[stanza];
      const email    = emailCol >= 0 ? String(row[emailCol] ?? '').trim().toLowerCase() : '';

      if (!checkIn || !cameraId || importo <= 0) continue;
      righe.push({ cameraId, checkIn, checkOut: checkOut ?? checkIn, nome, importo, tassa, tipo: isBooking ? 'booking' : 'privato', email });
    }
  }

  if (righe.length === 0) {
    return NextResponse.json({ ok: false, errore: 'Nessuna riga "Ricavo Booking" o "Privato" trovata nel file' }, { status: 400 });
  }

  const prenotazioni = await leggiPrenotazioni();
  let aggiornate = 0;
  let create = 0;

  for (const riga of righe) {
    // 1. Cerca corrispondenza esatta per camera + check-in + check-out
    let match = prenotazioni.find(p =>
      p.camera_id === riga.cameraId &&
      p.check_in  === riga.checkIn &&
      p.check_out === riga.checkOut &&
      p.stato !== 'cancellata'
    );

    // 2. Se non trovata, cerca record iCal con stesso check-out e check-in
    //    entro ±1 giorno (Booking.com spesso riporta check-in un giorno dopo)
    if (!match) {
      const checkOutMs = new Date(riga.checkOut).getTime();
      const checkInMs  = new Date(riga.checkIn).getTime();
      match = prenotazioni.find(p =>
        p.camera_id === riga.cameraId &&
        p.stato !== 'cancellata' &&
        p.fonte === 'ical' &&
        p.check_out === riga.checkOut &&
        Math.abs(new Date(p.check_in).getTime() - checkInMs) <= 86400000 // ±1 giorno
      ) ?? prenotazioni.find(p =>
        // 3. Fallback: stessa camera, sovrapposizione totale delle date (record manuale)
        p.camera_id === riga.cameraId &&
        p.stato !== 'cancellata' &&
        p.check_in <= riga.checkOut &&
        p.check_out >= riga.checkIn &&
        Math.abs(new Date(p.check_in).getTime() - checkInMs) <= 86400000 &&
        Math.abs(new Date(p.check_out).getTime() - checkOutMs) <= 86400000
      );
    }

    if (match) {
      // Trovata: aggiorna sempre da foglio (sia booking che privato)
      if (riga.nome) match.ospite_nome = riga.nome;
      match.importo_totale = riga.importo;
      if (riga.tassa > 0) match.tassa_soggiorno = riga.tassa;
      if (riga.email) match.ospite_email = riga.email;
      // Allinea le date al foglio Excel (fonte ufficiale)
      match.check_in  = riga.checkIn;
      match.check_out = riga.checkOut;
      aggiornate++;
    } else {
      // Non trovata: crea nuova prenotazione
      prenotazioni.push({
        id: randomUUID(),
        camera_id: riga.cameraId,
        ospite_nome: riga.nome,
        ospite_email: riga.email,
        ospite_telefono: '',
        check_in: riga.checkIn,
        check_out: riga.checkOut,
        importo_totale: riga.importo,
        tassa_soggiorno: riga.tassa > 0 ? riga.tassa : undefined,
        stato: 'confermata',
        note: riga.tipo === 'privato' ? 'Importata da Excel - Privato' : 'Importata da Excel - Booking',
        created_at: new Date().toISOString(),
        fonte: 'manuale',
      });
      create++;
    }
  }

  // Deduplicazione finale: rimuovi "Ospite Booking.com" generici che si sovrappongono
  // a prenotazioni con nome reale sulla stessa camera e date simili (±1 giorno)
  const idsDaTenere = new Set(prenotazioni.map(p => p.id));
  const prima = prenotazioni.length;

  const filtrate = prenotazioni.filter(p => {
    // Rimuovi sempre: nome generico + nessun importo + nessun ical_uid (fantasma)
    const nomeGenerico = !p.ospite_nome || p.ospite_nome === 'Ospite Booking.com';
    const senzaImporto = !p.importo_totale || p.importo_totale === 0;
    const haIcalUid   = !!p.ical_uid;

    if (nomeGenerico && senzaImporto && !haIcalUid) return false;

    // Rimuovi iCal generico se esiste già una prenotazione con nome reale
    // sulla stessa camera con date sovrapposte (±1 giorno)
    if (nomeGenerico && haIcalUid) {
      const checkInMs  = new Date(p.check_in).getTime();
      const checkOutMs = new Date(p.check_out).getTime();
      const hasDoppione = prenotazioni.some(q =>
        q.id !== p.id &&
        q.camera_id === p.camera_id &&
        q.stato !== 'cancellata' &&
        q.ospite_nome && q.ospite_nome !== 'Ospite Booking.com' &&
        Math.abs(new Date(q.check_in).getTime() - checkInMs) <= 86400000 &&
        Math.abs(new Date(q.check_out).getTime() - checkOutMs) <= 86400000
      );
      if (hasDoppione) return false;
    }

    return true;
  });

  const eliminate = prima - filtrate.length;

  await scriviPrenotazioni(filtrate);

  return NextResponse.json({ ok: true, aggiornate, create, eliminate, righeExcel: righe.length });
}
