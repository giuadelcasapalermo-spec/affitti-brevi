import { NextResponse } from 'next/server';
import { scriviImpostazioniSheets } from '@/lib/googlesheets';
import { Impostazioni } from '@/lib/types';
import fs from 'fs';
import path from 'path';

/**
 * POST /api/impostazioni/migra
 * Legge impostazioni.json dal filesystem (bundle Vercel o locale)
 * e le carica nel tab "Impostazioni" di Google Sheets.
 * Va chiamato una volta sola dopo il deploy.
 */
export async function POST() {
  const filePath = path.join(process.cwd(), 'data', 'impostazioni.json');

  let imp: Impostazioni;
  if (fs.existsSync(filePath)) {
    imp = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } else {
    imp = {
      ical_urls: {},
      nomi_camere: { 1: 'Rossa', 2: 'Gialla', 3: 'Verde', 4: 'Bianca', 5: 'Blue' },
      prezzi_camere: {},
      colori_camere: {},
      num_camere: 5,
    };
  }

  await scriviImpostazioniSheets(imp);
  return NextResponse.json({ ok: true, imp });
}
