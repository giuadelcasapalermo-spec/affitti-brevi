import { NextRequest, NextResponse } from 'next/server';
import { leggiPrenotazioni } from '@/lib/db';
import { leggiImpostazioni } from '@/lib/ical';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function icalDate(dateStr: string): string {
  // Converti 'yyyy-MM-dd' → '20240415' (formato iCal DATE, solo data, no orario)
  return dateStr.replace(/-/g, '');
}

function escape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cameraId: string }> }
) {
  const { cameraId } = await params;
  // Accetta sia /api/ical/1 che /api/ical/1.ics
  const cameraIdNum = parseInt(cameraId.replace(/\.ics$/i, ''));

  const imp = await leggiImpostazioni();
  const numCamere = imp.num_camere ?? 5;

  if (isNaN(cameraIdNum) || cameraIdNum < 1 || cameraIdNum > numCamere) {
    return new NextResponse('Camera non trovata', { status: 404 });
  }

  const cameraNome = imp.nomi_camere[cameraIdNum] ?? `Camera ${cameraIdNum}`;
  const nomeApp = imp.nome_app || 'Affitti Brevi';

  // Un feed per canale: ognuno esclude le prenotazioni che arrivano da quel canale stesso
  // (se no il canale vedrebbe le proprie prenotazioni come date bloccate da un altro calendario).
  //   ?canale=airbnb → per Airbnb: manuali + Booking.com (iCal e channel manager)
  //   predefinito    → per Booking.com: manuali + Airbnb (come prima, senza le importate da Booking)
  const perAirbnb = req.nextUrl.searchParams.get('canale') === 'airbnb';
  const prenotazioni = (await leggiPrenotazioni()).filter(
    (p) =>
      p.camera_id === cameraIdNum &&
      p.stato !== 'cancellata' &&
      (perAirbnb
        ? p.fonte !== 'airbnb'
        : p.fonte !== 'ical' && !p.note?.includes('BK:'))
  );

  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

  const eventi = prenotazioni.map((p) => {
    // UID propri per le prenotazioni importate da un altro calendario (non si ripubblica l'UID altrui)
    const importata = p.fonte === 'ical' || p.fonte === 'airbnb';
    const uid = (!importata && p.ical_uid) || `${p.id}@affitti-brevi`;
    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}Z`,
      `DTSTART;VALUE=DATE:${icalDate(p.check_in)}`,
      `DTEND;VALUE=DATE:${icalDate(p.check_out)}`,
      // Il feed è pubblico: ad Airbnb solo "non disponibile", senza nomi né note
      `SUMMARY:${perAirbnb ? 'Non disponibile' : escape(p.ospite_nome)}`,
      !perAirbnb && p.note ? `DESCRIPTION:${escape(p.note)}` : '',
      `STATUS:CONFIRMED`,
      'END:VEVENT',
    ]
      .filter(Boolean)
      .join('\r\n');
  });

  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${nomeApp}//IT`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${cameraNome} - ${nomeApp}`,
    `X-WR-TIMEZONE:Europe/Rome`,
    ...eventi,
    'END:VCALENDAR',
  ].join('\r\n');

  return new NextResponse(calendar, {
    headers: {
      ...CORS,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="camera-${cameraIdNum}${perAirbnb ? '-airbnb' : ''}.ics"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
