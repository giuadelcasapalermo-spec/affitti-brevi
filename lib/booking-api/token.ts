/**
 * JWT token manager — Booking.com Connectivity API.
 *
 * Token valido 1 ora; rinnoviamo 5 minuti prima della scadenza.
 * Cache in-memory: funziona per warm instances su Vercel.
 * Cold start = massimo 1 fetch per ora per struttura.
 */

interface CachedToken {
  value: string;
  expiresAt: number;
}

const _cache = new Map<string, CachedToken>();

const TOKEN_ENDPOINT =
  'https://connectivity-authentication.booking.com/token-based-authentication/exchange';

/**
 * Restituisce un JWT valido per la struttura indicata.
 * Se clientId/clientSecret non passati, usa le env vars globali.
 */
export async function getToken(
  clientId?: string,
  clientSecret?: string
): Promise<string> {
  const id = clientId ?? process.env.BOOKING_CLIENT_ID;
  const secret = clientSecret ?? process.env.BOOKING_CLIENT_SECRET;

  if (!id || !secret) {
    throw new Error(
      'Booking.com: BOOKING_CLIENT_ID e BOOKING_CLIENT_SECRET non configurati'
    );
  }

  const cached = _cache.get(id);
  const now = Date.now();
  if (cached && cached.expiresAt - now > 5 * 60 * 1000) {
    return cached.value;
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: id, client_secret: secret }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Booking.com token exchange [${res.status}]: ${text}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  // Il nome del campo token varia tra versioni API — proviamo tutti
  const token = (data.token ?? data.access_token ?? data.jwt) as string | undefined;
  if (!token) {
    throw new Error(`Token non trovato nella risposta: ${JSON.stringify(data)}`);
  }

  _cache.set(id, { value: token, expiresAt: now + 60 * 60 * 1000 });
  return token;
}

/** Invalida il token in cache (es. dopo un 401) */
export function invalidateToken(clientId?: string): void {
  const id = clientId ?? process.env.BOOKING_CLIENT_ID ?? '';
  _cache.delete(id);
}
