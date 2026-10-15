import { GoogleGenerativeAI, type Part } from '@google/generative-ai';

// Gli account Google creati di recente non hanno più accesso a gemini-2.5-flash (404 "no longer
// available to new users"); i modelli nuovi ogni tanto rispondono 503 per picchi di carico.
// GEMINI_MODEL (facoltativa) sceglie il primo modello; sugli errori di modello/carico/quota si passa al successivo.
const MODELLI_RISERVA = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];

function modelli(): string[] {
  const scelto = process.env.GEMINI_MODEL?.trim();
  return [...new Set([...(scelto ? [scelto] : []), ...MODELLI_RISERVA])];
}

function erroreRecuperabile(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\[(404|429|500|503)[ \]]/.test(msg) || /not found|no longer available|high demand|overloaded|quota/i.test(msg);
}

/** Chiama Gemini e restituisce il testo della risposta, provando i modelli in ordine. */
export async function generaTesto(contenuto: string | Array<string | Part>): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  let ultimoErrore: unknown;
  for (const nome of modelli()) {
    try {
      const result = await genAI.getGenerativeModel({ model: nome }).generateContent(contenuto);
      return result.response.text().trim();
    } catch (err) {
      ultimoErrore = err;
      if (!erroreRecuperabile(err)) throw err;
      console.warn(`[gemini] ${nome} non disponibile, provo il successivo:`, err instanceof Error ? err.message : err);
    }
  }
  throw ultimoErrore;
}
