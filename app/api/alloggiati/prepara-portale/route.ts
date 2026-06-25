import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStrutturaAttiva } from '@/lib/strutture';
import { leggiAlloggiati, generaFileAlloggiati, preparaBatchPerPortale, validaBatch } from '@/lib/alloggiati';

const SOAP_NS = 'AlloggiatiService';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// Prepara i dati e costruisce gli envelope SOAP da inviare dal browser (IP italiano).
// Non effettua alcuna chiamata al portale — la fa il browser.
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const strutturaId = cookieStore.get('struttura_id')?.value;
    const struttura = await getStrutturaAttiva(strutturaId);

    const creds = struttura.alloggiati_credentials;
    if (!creds?.utente || !creds?.password || !creds?.wskey) {
      return NextResponse.json(
        { ok: false, errore: 'Credenziali AlloggiatiWeb non configurate. Vai in Impostazioni → Strutture → Modifica.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const data: string = body.data ?? new Date().toISOString().split('T')[0];

    const alloggiati = await leggiAlloggiati(struttura.id, data);
    if (alloggiati.length === 0) {
      return NextResponse.json({ ok: false, errore: 'Nessun alloggiato da inviare per questa data.' }, { status: 400 });
    }

    const oreRitardo = (Date.now() - new Date(data).getTime()) / 3_600_000;
    if (oreRitardo > 36) {
      const giorni = Math.floor(oreRitardo / 24);
      return NextResponse.json({
        ok: false,
        errore: `Data ${data} è ${giorni} giorn${giorni === 1 ? 'o' : 'i'} nel passato. AlloggiatiWeb richiede invio entro 24h.`,
      }, { status: 400 });
    }

    const preparati = preparaBatchPerPortale(alloggiati);
    const errori = validaBatch(preparati);
    if (errori.length > 0) {
      const desc = errori.map(e => `${e.ospite}: ${e.errori.join(', ')}`).join(' | ');
      return NextResponse.json({ ok: false, errore: `Dati non validi — correggi prima di inviare. ${desc}`, erroriValidazione: errori }, { status: 400 });
    }

    if (preparati.some(a => a.tipo === '19') && !preparati.some(a => a.tipo === '17' || a.tipo === '18')) {
      return NextResponse.json({
        ok: false,
        errore: 'Batch non valido: tipo 19 presente senza Capo Famiglia (17) né Capo Gruppo (18).',
      }, { status: 400 });
    }

    const contenuto = generaFileAlloggiati(preparati);
    const righe = contenuto.split('\r\n').filter(r => r.length > 0);

    // Envelope completo per GenerateToken (le credenziali sono dell'utente stesso, usate nel suo browser)
    const tokenEnvelope = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><tns:GenerateToken xmlns:tns="${SOAP_NS}"><tns:Utente>${esc(creds.utente)}</tns:Utente><tns:Password>${esc(creds.password)}</tns:Password><tns:WsKey>${esc(creds.wskey)}</tns:WsKey></tns:GenerateToken></soap:Body></soap:Envelope>`;

    // Template per Send — __TOKEN__ viene sostituito dal browser dopo aver ricevuto il token
    const elencoXml = righe.map(r => `<tns:string>${esc(r)}</tns:string>`).join('');
    const sendEnvelopeTemplate = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><tns:Send xmlns:tns="${SOAP_NS}"><tns:Utente>${esc(creds.utente)}</tns:Utente><tns:token>__TOKEN__</tns:token><tns:ElencoSchedine>${elencoXml}</tns:ElencoSchedine></tns:Send></soap:Body></soap:Envelope>`;

    // righe incluse per diagnosi client-side in caso di errore dal portale
    const righeInfo = righe.map((r, i) => ({
      i,
      tipo: r.substring(0, 2),
      dataArrivo: r.substring(2, 12),
      permanenza: r.substring(12, 14).trim(),
      cognome: r.substring(14, 64).trimEnd(),
      nome: r.substring(64, 94).trimEnd(),
      sesso: r.substring(94, 95),
      dataNascita: r.substring(95, 105),
      comuneNascita: r.substring(105, 114),
      provNascita: r.substring(114, 116),
      statoNascita: r.substring(116, 125),
      cittadinanza: r.substring(125, 134),
      tipoDoc: r.substring(134, 139),
      numeroDoc: r.substring(139, 159).trimEnd(),
      luogoRilascio: r.substring(159, 168),
      len: r.length,
      raw: r,
    }));

    return NextResponse.json({ ok: true, tokenEnvelope, sendEnvelopeTemplate, numRighe: righe.length, righeInfo });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Errore sconosciuto';
    return NextResponse.json({ ok: false, errore: msg }, { status: 500 });
  }
}
