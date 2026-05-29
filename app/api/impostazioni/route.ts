import { NextRequest, NextResponse } from 'next/server';
import { leggiImpostazioni, scriviImpostazioni } from '@/lib/ical';

export async function GET() {
  return NextResponse.json(await leggiImpostazioni());
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const imp = await leggiImpostazioni();
  if (body.ical_urls !== undefined) imp.ical_urls = body.ical_urls;
  if (body.nomi_camere !== undefined) imp.nomi_camere = body.nomi_camere;
  if (body.google_sheets_abilitato !== undefined) imp.google_sheets_abilitato = body.google_sheets_abilitato;
  if (body.google_sheet_id !== undefined) imp.google_sheet_id = body.google_sheet_id;
  if (body.nome_app !== undefined) imp.nome_app = body.nome_app;
  if (body.logo_url !== undefined) imp.logo_url = body.logo_url;
  if (body.num_camere !== undefined) imp.num_camere = Number(body.num_camere);
  if (body.prezzi_camere !== undefined) imp.prezzi_camere = body.prezzi_camere;
  if (body.colori_camere !== undefined) imp.colori_camere = body.colori_camere;
  if (body.checkin_email_days !== undefined) imp.checkin_email_days = body.checkin_email_days === '' ? undefined : Number(body.checkin_email_days);
  await scriviImpostazioni(imp);
  return NextResponse.json(imp);
}
