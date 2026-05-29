import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStrutturaAttiva } from '@/lib/strutture';
import { leggiAlloggiati, generaFileAlloggiati } from '@/lib/alloggiati';

const SOAP_ENDPOINT = 'https://alloggiatiweb.poliziadistato.it/service/service.asmx';
const SOAP_NS = 'AlloggiatiService';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function extractXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<(?:[\\w]*:)?${tag}>([\\s\\S]*?)<\\/(?:[\\w]*:)?${tag}>`, 'i'));
  return match?.[1]?.trim() ?? '';
}

async function callSoap(method: string, body: string): Promise<string> {
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    ${body}
  </soap:Body>
</soap:Envelope>`;

  const res = await fetch(SOAP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': `"${SOAP_NS}/${method}"`,
    },
    body: envelope,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} dal portale AlloggiatiWeb`);
  return await res.text();
}

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

    const contenuto = generaFileAlloggiati(alloggiati);

    // Step 1: genera token di sessione
    const tokenBody = `<tns:GenerateToken xmlns:tns="${SOAP_NS}">
      <tns:Utente>${escapeXml(creds.utente)}</tns:Utente>
      <tns:Password>${escapeXml(creds.password)}</tns:Password>
      <tns:WsKey>${escapeXml(creds.wskey)}</tns:WsKey>
    </tns:GenerateToken>`;

    const tokenXml = await callSoap('GenerateToken', tokenBody);

    if (tokenXml.includes('<faultstring>') || tokenXml.includes(':Fault>')) {
      const fault = extractXmlTag(tokenXml, 'faultstring');
      return NextResponse.json({ ok: false, errore: `Errore SOAP: ${fault}` });
    }

    const tokenEsito = extractXmlTag(tokenXml, 'esito');
    if (tokenEsito !== 'true') {
      const errCod = extractXmlTag(tokenXml, 'ErroreCod');
      const errDes = extractXmlTag(tokenXml, 'ErroreDes');
      return NextResponse.json({ ok: false, errore: `Autenticazione fallita: ${errDes || errCod || `Esito ${tokenEsito}`}` });
    }

    const token = extractXmlTag(tokenXml, 'token');
    if (!token) {
      return NextResponse.json({ ok: false, errore: 'Token non ricevuto dal portale.' });
    }

    // Step 2: invia il file — ogni riga è un elemento <tns:string>
    const righe = contenuto.split('\r\n').filter(r => r.length > 0);
    const elencoXml = righe.map(r => `        <tns:string>${escapeXml(r)}</tns:string>`).join('\n');

    const sendBody = `<tns:Send xmlns:tns="${SOAP_NS}">
      <tns:Utente>${escapeXml(creds.utente)}</tns:Utente>
      <tns:token>${escapeXml(token)}</tns:token>
      <tns:ElencoSchedine>
${elencoXml}
      </tns:ElencoSchedine>
    </tns:Send>`;

    const sendXml = await callSoap('Send', sendBody);

    if (sendXml.includes('<faultstring>') || sendXml.includes(':Fault>')) {
      const fault = extractXmlTag(sendXml, 'faultstring');
      return NextResponse.json({ ok: false, errore: `Errore SOAP invio: ${fault}` });
    }

    // Send restituisce SchedineValide + eventuale Dettaglio con errori
    const schedineValide = extractXmlTag(sendXml, 'SchedineValide');
    const errDes = extractXmlTag(sendXml, 'ErroreDes');
    const errDet = extractXmlTag(sendXml, 'ErroreDettaglio');
    const errCod = extractXmlTag(sendXml, 'ErroreCod');

    if (errCod || errDes) {
      const diagRighe = righe.map((r, i) => ({
        i,
        tipo: r.substring(0, 2),
        cognome: r.substring(14, 64).trimEnd(),
        nome: r.substring(64, 94).trimEnd(),
        dataNascita: r.substring(95, 105),
        comuneNascita: r.substring(105, 114),
        provNascita: r.substring(114, 116),
        statoNascita: r.substring(116, 125),
        cittadinanza: r.substring(125, 134),
        tipoDoc: r.substring(134, 139),
        luogoRilascio: r.substring(159, 168),
        len: r.length,
        raw: r,
      }));
      return NextResponse.json({
        ok: false,
        errore: `Invio fallito: ${errDes || errCod}${errDet ? ` — ${errDet}` : ''}`,
        diagnosi: diagRighe,
        soapResponse: sendXml,
      });
    }

    const valide = parseInt(schedineValide) || alloggiati.length;
    return NextResponse.json({
      ok: true,
      messaggio: `${valide} schedine inviate al portale con successo`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Errore sconosciuto';
    return NextResponse.json({ ok: false, errore: msg }, { status: 500 });
  }
}
