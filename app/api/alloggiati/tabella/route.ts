import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Agent } from 'undici';
import { getStrutturaAttiva } from '@/lib/strutture';

export const preferredRegion = 'fra1'; // Il portale PS blocca IP USA — usa Francoforte (EU)

const SOAP_ENDPOINT = 'https://alloggiatiweb.poliziadistato.it/service/service.asmx';
const SOAP_NS = 'AlloggiatiService';

const soapAgent = new Agent({ connect: { rejectUnauthorized: false } });

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function extractXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<(?:[\\w]*:)?${tag}>([\\s\\S]*?)<\\/(?:[\\w]*:)?${tag}>`, 'i'));
  return match?.[1]?.trim() ?? '';
}

async function callSoap(method: string, body: string): Promise<string> {
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>${body}</soap:Body>
</soap:Envelope>`;
  const res = await fetch(SOAP_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': `"${SOAP_NS}/${method}"` },
    body: envelope,
    signal: AbortSignal.timeout(30000),
    // @ts-ignore
    dispatcher: soapAgent,
  });
  return await res.text();
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const strutturaId = cookieStore.get('struttura_id')?.value;
    const struttura = await getStrutturaAttiva(strutturaId);
    const creds = struttura.alloggiati_credentials;
    if (!creds?.utente || !creds?.password || !creds?.wskey) {
      return NextResponse.json({ errore: 'Credenziali non configurate' }, { status: 400 });
    }

    const tipo = req.nextUrl.searchParams.get('tipo') ?? 'Nazioni';
    const cerca = req.nextUrl.searchParams.get('cerca') ?? '';

    // Get token
    const tokenXml = await callSoap('GenerateToken', `<tns:GenerateToken xmlns:tns="${SOAP_NS}">
      <tns:Utente>${escapeXml(creds.utente)}</tns:Utente>
      <tns:Password>${escapeXml(creds.password)}</tns:Password>
      <tns:WsKey>${escapeXml(creds.wskey)}</tns:WsKey>
    </tns:GenerateToken>`);

    if (extractXmlTag(tokenXml, 'esito') !== 'true') {
      return NextResponse.json({ errore: 'Auth fallita', raw: tokenXml });
    }
    const token = extractXmlTag(tokenXml, 'token');

    // Try Tabella method
    const tabellaXml = await callSoap('Tabella', `<tns:Tabella xmlns:tns="${SOAP_NS}">
      <tns:Utente>${escapeXml(creds.utente)}</tns:Utente>
      <tns:token>${escapeXml(token)}</tns:token>
      <tns:NomeTabella>${escapeXml(tipo)}</tns:NomeTabella>
    </tns:Tabella>`);

    // Parse the table entries if available
    const entries: Array<{ codice: string; nome: string }> = [];
    const entryRegex = /<(?:[\w]+:)?Alloggiato>([\s\S]*?)<\/(?:[\w]+:)?Alloggiato>/gi;
    let m;
    while ((m = entryRegex.exec(tabellaXml)) !== null) {
      const block = m[1];
      const codice = extractXmlTag(block, 'Codice') || extractXmlTag(block, 'codice');
      const nome = extractXmlTag(block, 'Descrizione') || extractXmlTag(block, 'descrizione') || extractXmlTag(block, 'Nome') || extractXmlTag(block, 'nome');
      if (codice) entries.push({ codice, nome });
    }

    // Also try generic item tags
    if (entries.length === 0) {
      const itemRegex = /<(?:[\w]+:)?(?:Luogo|Paese|Comune|Item|Nazione|Row|Record)>([\s\S]*?)<\/(?:[\w]+:)?(?:Luogo|Paese|Comune|Item|Nazione|Row|Record)>/gi;
      while ((m = itemRegex.exec(tabellaXml)) !== null) {
        const block = m[1];
        const codice = extractXmlTag(block, 'Codice') || extractXmlTag(block, 'Id') || extractXmlTag(block, 'Code');
        const nome = extractXmlTag(block, 'Descrizione') || extractXmlTag(block, 'Nome') || extractXmlTag(block, 'Name');
        if (codice) entries.push({ codice, nome });
      }
    }

    // Filter by search term if provided
    const filtered = cerca
      ? entries.filter(e => e.nome.toUpperCase().includes(cerca.toUpperCase()) || e.codice.includes(cerca))
      : entries.slice(0, 50);

    return NextResponse.json({
      tipo,
      cerca,
      count: entries.length,
      risultati: filtered,
      rawXml: tabellaXml.substring(0, 3000),
    });
  } catch (e) {
    return NextResponse.json({ errore: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
