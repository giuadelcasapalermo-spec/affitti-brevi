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

/**
 * Messaggio per l'utente: gli errori noti di Gemini (credito, quota, chiave, carico) diventano
 * frasi comprensibili; gli altri restano tecnici con il prefisso indicato.
 */
export function messaggioErroreAI(err: unknown, prefisso: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/\[402[ \]]|prepayment|billing/i.test(msg)) {
    return 'Servizio AI non disponibile: il credito del servizio è esaurito. Inserisci i dati manualmente e avvisa l\'amministratore.';
  }
  if (/\[429[ \]]|quota|rate limit/i.test(msg)) {
    return 'Servizio AI temporaneamente non disponibile: limite di utilizzo raggiunto. Riprova tra qualche minuto o inserisci i dati manualmente.';
  }
  if (/\[(401|403)[ \]]|api key not valid|permission denied/i.test(msg)) {
    return 'Servizio AI non disponibile: chiave di accesso non valida. Inserisci i dati manualmente e avvisa l\'amministratore.';
  }
  if (/\[(500|503)[ \]]|high demand|overloaded/i.test(msg)) {
    return 'Servizio AI momentaneamente sovraccarico. Riprova tra qualche istante.';
  }
  return `${prefisso}: ${msg}`;
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
