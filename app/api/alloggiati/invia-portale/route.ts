import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStrutturaAttiva } from '@/lib/strutture';
import { leggiAlloggiati, generaFileAlloggiati, preparaBatchPerPortale, validaBatch } from '@/lib/alloggiati';

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

    // Avviso se la data è più di 24h nel passato (il portale rifiuta invii tardivi)
    const dataMs = new Date(data).getTime();
    const oraMs = Date.now();
    const oreRitardo = (oraMs - dataMs) / 3_600_000;
    if (oreRitardo > 36) {
      const giorni = Math.floor(oreRitardo / 24);
      return NextResponse.json({
        ok: false,
        errore: `Data ${data} è ${giorni} giorn${giorni === 1 ? 'o' : 'i'} nel passato. AlloggiatiWeb richiede invio entro 24h dall'arrivo. Il portale rifiuterà la schedina con "Data di Arrivo Errata".`,
      }, { status: 400 });
    }

    // Prepara batch: auto-fix tipo 16 senza tipo 17, ordina per prenotazione
    const alloggiatiPreparati = preparaBatchPerPortale(alloggiati);

    // Validazione dati prima di generare il file: errori chiari in italiano all'utente
    const erroriValidazione = validaBatch(alloggiatiPreparati);
    if (erroriValidazione.length > 0) {
      const desc = erroriValidazione
        .map(e => `${e.ospite}: ${e.errori.join(', ')}`)
        .join(' | ');
      return NextResponse.json(
        { ok: false, errore: `Dati mancanti o non validi — correggi prima di inviare. ${desc}`, erroriValidazione },
        { status: 400 }
      );
    }

    // Validazione tipo 19 senza alcun capo (tipo 17 o tipo 18)
    if (
      alloggiatiPreparati.some(a => a.tipo === '19') &&
      !alloggiatiPreparati.some(a => a.tipo === '17' || a.tipo === '18')
    ) {
      return NextResponse.json({
        ok: false,
        errore: 'Batch non valido: tipo 19 (Familiare) presente senza Capo Famiglia (tipo 17) né Capo Gruppo (tipo 18).',
      }, { status: 400 });
    }

    const contenuto = generaFileAlloggiati(alloggiatiPreparati);

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
    const numRiga = extractXmlTag(sendXml, 'NumRiga');
    const nomeCampo = extractXmlTag(sendXml, 'NomeCampo');

    // Errore reale solo se meno schedine sono state accettate rispetto a quelle inviate.
    // Alcuni EsitoOperazioneServizio con esito=true possono avere ErroreCod come warning: non sono errori.
    const totalValid = parseInt(schedineValide) || 0;
    if (totalValid < righe.length) {
      // Trova il primo EsitoOperazioneServizio con esito=false per il messaggio di errore
      const esitoRegex = /<EsitoOperazioneServizio>([\s\S]*?)<\/EsitoOperazioneServizio>/g;
      let errDes = '', errDet = '', errCod = '';
      let m: RegExpExecArray | null;
      while ((m = esitoRegex.exec(sendXml)) !== null) {
        const inner = m[1];
        if (extractXmlTag(inner, 'esito') === 'false') {
          errCod = extractXmlTag(inner, 'ErroreCod');
          errDes = extractXmlTag(inner, 'ErroreDes');
          errDet = extractXmlTag(inner, 'ErroreDettaglio');
          break;
        }
      }
      if (!errDes && !errCod) {
        // Fallback: prendi il primo ErroreDes/Cod disponibile (anche da esito=true con warning)
        errCod = extractXmlTag(sendXml, 'ErroreCod');
        errDes = extractXmlTag(sendXml, 'ErroreDes');
        errDet = extractXmlTag(sendXml, 'ErroreDettaglio');
      }
      const diagRighe = righe.map((r, i) => ({
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
        db_comune_nascita: alloggiatiPreparati[i]?.comune_nascita ?? '?',
        db_luogo_rilascio: alloggiatiPreparati[i]?.luogo_rilascio ?? '?',
        db_cittadinanza: alloggiatiPreparati[i]?.cittadinanza ?? '?',
        db_stato_nascita: alloggiatiPreparati[i]?.stato_nascita ?? '?',
      }));
      let errMsg = `Invio fallito: ${errDes || errCod}`;
      if (errDet) errMsg += ` — ${errDet}`;
      if (nomeCampo) errMsg += ` (campo: ${nomeCampo})`;
      if (numRiga) errMsg += ` [riga ${numRiga}]`;
      return NextResponse.json({
        ok: false,
        errore: errMsg,
        diagnosi: diagRighe,
        soapXml: sendXml,
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
