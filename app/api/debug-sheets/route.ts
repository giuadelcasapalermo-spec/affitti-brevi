import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { leggiPrenotazioni } from '@/lib/db';
import { leggiImpostazioni } from '@/lib/ical';

const SPREADSHEET_ID_FALLBACK = '1t8sY-JBkSDAnIBhQA_xwotRjxAzRCJ1XMUrxbpHlJpM';

const STANZA_ID: Record<string, number> = {
  'rossa': 1, 'camera 1': 1, '1': 1,
  'gialla': 2, 'camera 2': 2, '2': 2,
  'verde': 3, 'camera 3': 3, '3': 3,
  'bianca': 4, 'camera 4': 4, '4': 4,
  'blue': 5, 'blu': 5, 'camera 5': 5, '5': 5,
};

function serialToISO(serial: number): string {
  return new Date((serial - 25569) * 86400 * 1000).toISOString().split('T')[0];
}
function parseSheetDate(val: string | number | undefined): string | null {
  if (!val) return null;
  if (typeof val === 'number') return serialToISO(val);
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return null;
}

function getAuth() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (clientId && clientSecret && refreshToken) {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
  }
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('No auth');
  return new google.auth.GoogleAuth({ credentials: JSON.parse(raw), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
}

export async function GET() {
  const imp = await leggiImpostazioni();
  const sid = imp.google_sheet_id?.trim() || SPREADSHEET_ID_FALLBACK;

  const auth = getAuth();
  const resolvedAuth = auth instanceof GoogleAuth ? await auth.getClient() : auth;
  const sheets = google.sheets({ version: 'v4', auth: resolvedAuth as never });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sid });
  const tabs = meta.data.sheets?.map(s => s.properties?.title ?? '') ?? [];

  const prenotazioni = await leggiPrenotazioni();
  const byKey = new Map(prenotazioni.map(p => [`${p.camera_id}|${p.check_in}|${p.check_out}`, p]));
  const byCheckIn = new Map(prenotazioni.map(p => [`${p.camera_id}|${p.check_in}`, p]));

  const risultati: Record<string, unknown[]> = {};

  for (const tab of tabs) {
    if (tab === 'Prima Nota App' || tab === 'Impostazioni') continue;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sid,
      range: `'${tab}'!A:P`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const rows = (res.data.values ?? []) as (string|number)[][];
    const hIdx = rows.findIndex(r => String(r[0]??'').trim() === 'Tipologia');
    if (hIdx === -1) continue;

    const ncols = rows[hIdx].length;
    const is2025 = ncols <= 12;
    const C = is2025
      ? { tipo:0, desc:1, ent:3, tassa:-1, dataI:6, dataF:7,  stanza:9  }
      : { tipo:0, desc:1, ent:3, tassa:5,  dataI:8,  dataF:9,  stanza:11 };

    const righe = [];
    for (let i = hIdx + 1; i < rows.length; i++) {
      const row  = rows[i];
      const tipo = String(row[C.tipo]??'').trim();
      if (!tipo) continue;

      const tipoL    = tipo.toLowerCase();
      const isRicavo = ['affitto','ricavo booking','ricavo privato'].includes(tipoL);

      const checkIn  = parseSheetDate(row[C.dataI] as string|number|undefined);
      const checkOut = parseSheetDate(row[C.dataF] as string|number|undefined);
      const stanzaRaw = String(row[C.stanza]??'').trim();
      const camera_id = STANZA_ID[stanzaRaw.toLowerCase()] ?? null;
      const nome    = String(row[C.desc]??'').trim();
      const importo = parseFloat(String(row[C.ent]??'')) || 0;

      let match = null;
      let matchType = null;
      if (isRicavo && camera_id && checkIn) {
        const co = checkOut ?? checkIn;
        const exact = byKey.get(`${camera_id}|${checkIn}|${co}`);
        if (exact) { match = { id: exact.id, nome: exact.ospite_nome, fonte: exact.fonte }; matchType = 'exact'; }
        else {
          const fb = byCheckIn.get(`${camera_id}|${checkIn}`);
          if (fb) { match = { id: fb.id, nome: fb.ospite_nome, fonte: fb.fonte, check_out_db: fb.check_out }; matchType = 'fallback_check_in'; }
          else { matchType = 'NO_MATCH → crea'; }
        }
      } else if (!isRicavo) {
        matchType = `tipo_ignorato (${tipo})`;
      } else {
        matchType = `skip: camera_id=${camera_id} checkIn=${checkIn}`;
      }

      righe.push({
        riga: i + 1,
        tipo,
        nome,
        importo,
        checkIn,
        checkOut,
        stanza: stanzaRaw,
        camera_id,
        matchType,
        match,
        rawCols: { [C.dataI]: row[C.dataI], [C.dataF]: row[C.dataF], [C.stanza]: row[C.stanza], [C.ent]: row[C.ent] },
      });
    }
    if (righe.length > 0) risultati[tab] = righe;
  }

  return NextResponse.json({ sid, tabs, ncamere: imp.num_camere, risultati });
}
