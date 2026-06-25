import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { nomePaeseACodice, aggettivoCittadinanzaACodice } from '@/lib/codici-alloggiati';
import { nomeACodiceComune } from '@/lib/comuni-italiani';

export const maxDuration = 30;

const PROMPT = `Sei un sistema OCR specializzato in documenti d'identità. Analizza questa immagine di un documento (carta d'identità, passaporto, patente) ed estrai i dati anagrafici.

Rispondi SOLO con JSON valido, nessun testo aggiuntivo:
{
  "cognome": "<solo cognome/surname, MAIUSCOLO>",
  "nome": "<solo nome/given names, MAIUSCOLO>",
  "sesso": "<M o F — se il documento mostra K o W converti in F, altrimenti M>",
  "data_nascita": "<YYYY-MM-DD — converti qualsiasi formato di data>",
  "tipo_documento": "<PP per passaporto, CI per carta d'identità, PA per patente>",
  "numero_documento": "<numero/serie del documento, senza spazi>",
  "paese_nascita": "<paese di nascita in italiano, es. ITALIA, POLONIA, BRASILE>",
  "cittadinanza_testo": "<nazionalità in italiano, es. ITALIANA, POLACCA, BRASILIANA>",
  "luogo_nascita_testo": "<città/luogo di nascita se leggibile, altrimenti stringa vuota>",
  "luogo_rilascio_testo": "<comune/città che ha rilasciato il documento, MAIUSCOLO, altrimenti stringa vuota>"
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
    // Estrai il blocco JSON dalla risposta (gestisce ```json ... ``` e testo libero prima/dopo)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Risposta non contiene JSON valido');
    const json = JSON.parse(jsonMatch[0]);
    // Converti nomi paese/nazionalità in codici AlloggiatiWeb
    json.codice_stato_nascita  = nomePaeseACodice(json.paese_nascita ?? '');
    json.codice_cittadinanza   = aggettivoCittadinanzaACodice(json.cittadinanza_testo ?? '')
                                 || nomePaeseACodice(json.paese_nascita ?? '');
    json.codice_luogo_rilascio = nomeACodiceComune(json.luogo_rilascio_testo ?? '');
    return NextResponse.json(json);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[alloggiati/scan]', msg);
    return NextResponse.json({ errore: `Errore elaborazione: ${msg}` }, { status: 500 });
  }
}
