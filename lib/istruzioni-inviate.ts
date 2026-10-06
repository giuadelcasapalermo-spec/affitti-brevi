// Registro di quando è stato preparato il messaggio WhatsApp con le istruzioni di check-in per una prenotazione
// (tabella impostazioni, tipo 'istruzioni_inviate'): l'invio vero avviene dal WhatsApp del telefono, quindi
// si registra il momento in cui l'app ha composto il messaggio e aperto WhatsApp.
import sql from './postgres';

export async function segnaIstruzioniInviate(prenotazioneId: string): Promise<string> {
  const ora = new Date().toISOString();
  await sql`
    INSERT INTO impostazioni (tipo, chiave, valore) VALUES ('istruzioni_inviate', ${prenotazioneId}, ${ora})
    ON CONFLICT (tipo, chiave) DO UPDATE SET valore = EXCLUDED.valore
  `;
  return ora;
}

export async function leggiIstruzioniInviate(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const rows = await sql`SELECT chiave, valore FROM impostazioni WHERE tipo = 'istruzioni_inviate' AND chiave = ANY(${ids})`;
  return Object.fromEntries(rows.map(r => [r.chiave as string, r.valore as string]));
}
