import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { nomePaeseACodice, aggettivoCittadinanzaACodice, normalizzaNome } from '@/lib/codici-alloggiati';
import { nomeACodiceComune } from '@/lib/comuni-italiani';

export const maxDuration = 30;

const PROMPT = `Sei un sistema OCR specializzato in documenti d'identità. Analizza questa immagine di un documento (carta d'identità, passaporto, patente, permesso di soggiorno) ed estrai i dati anagrafici.

Rispondi SOLO con JSON valido, nessun testo aggiuntivo:
{
  "cognome": "<solo cognome/surname, MAIUSCOLO>",
  "nome": "<solo nome/given names, MAIUSCOLO>",
  "sesso": "<M o F — se il documento mostra K o W converti in F, altrimenti M>",
  "data_nascita": "<YYYY-MM-DD — converti qualsiasi formato di data>",
  "tipo_documento": "<PP per passaporto, CI per carta d'identità elettronica italiana, ID per carta d'identità o permesso di soggiorno di un cittadino straniero, DL per patente di guida>",
  "numero_documento": "<numero/serie del documento, senza spazi>",
  "paese_nascita": "<SEMPRE e SOLO in italiano, MAI in inglese, es. ITALIA, POLONIA, BRASILE, MACEDONIA DEL NORD, REGNO UNITO>",
  "cittadinanza_testo": "<nazionalità SEMPRE e SOLO in italiano, MAI in inglese, es. ITALIANA, POLACCA, BRASILIANA, MACEDONE>",
  "luogo_nascita_testo": "<città/luogo di nascita se leggibile, altrimenti stringa vuota>",
  "luogo_rilascio_testo": "<autorità/luogo che ha rilasciato il documento — NON è il luogo di nascita. Se rilasciato da un comune italiano, il nome del comune, MAIUSCOLO. Se rilasciato da un'autorità estera (ministero, questura, ambasciata, ufficio immigrazione straniero), il nome dello STATO che lo ha rilasciato, SEMPRE in italiano, MAIUSCOLO. Altrimenti stringa vuota.>"
}

Se un campo non è leggibile o non presente, usa stringa vuota. Non inventare dati.`;

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ errore: 'GEMINI_API_KEY non configurata' }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get('immagine') as File | null;
  if (!file) {
    return NextResponse.json({ errore: 'Immagine mancante' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp';

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64 } },
      PROMPT,
    ]);
    const rawText = result.response.text().trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Risposta non contiene JSON valido');
    const json = JSON.parse(jsonMatch[0]);
    json.codice_stato_nascita  = nomePaeseACodice(json.paese_nascita ?? '');
    json.codice_cittadinanza   = aggettivoCittadinanzaACodice(json.cittadinanza_testo ?? '')
                                 || nomePaeseACodice(json.paese_nascita ?? '');
    // Il comune di nascita ha senso solo per chi è nato in Italia: per gli stranieri
    // il segnale che deve andare al form è "non valorizzare il comune", non il nome della città estera
    json.nato_in_italia = !json.paese_nascita || normalizzaNome(json.paese_nascita) === 'ITALIA';
    // Luogo di rilascio: prova prima come comune italiano, altrimenti come nome di stato estero
    // (un permesso/documento rilasciato da un'autorità estera riporta lo STATO, non una città)
    const comuneRilascio = nomeACodiceComune(json.luogo_rilascio_testo ?? '');
    json.codice_luogo_rilascio = comuneRilascio
      || (json.luogo_rilascio_testo && nomePaeseACodice(json.luogo_rilascio_testo) ? normalizzaNome(json.luogo_rilascio_testo) : '');
    return NextResponse.json(json);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[registrazione/scan]', msg);
    return NextResponse.json({ errore: `Errore elaborazione: ${msg}` }, { status: 500 });
  }
}
