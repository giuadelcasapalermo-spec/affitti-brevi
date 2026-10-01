// Invii automatici per struttura (attivati in Impostazioni → Camere → Check-in), lanciati da /api/cron/automazioni:
// schedine ad AlloggiatiWeb il giorno del check-in (tentativo delle 15:00 e finale delle 21:00).
// Gli errori arrivano su WhatsApp al numero della struttura, con i dati dell'ospite.
// I messaggi agli ospiti (link e istruzioni) si mandano da Prenotazioni → WhatsApp (components/InvioMassivoWhatsApp).
import sql from './postgres';
import type { Prenotazione, Struttura, Alloggiato } from './types';
import { leggiStrutture } from './strutture';
import { leggiPrenotazioni } from './db';
import { leggiAlloggiati, marcaInviatiPortale } from './alloggiati-db';
import { inviaSchedinePortale } from './portale-alloggiati';
import { inviaWhatsAppModello } from './twilio-send';

const FUSO = 'Europe/Rome';

/** Data di oggi (YYYY-MM-DD) in Italia, spostata di `giorni` */
export function dataItalia(giorni = 0): string {
  const oggi = new Intl.DateTimeFormat('sv-SE', { timeZone: FUSO }).format(new Date());
  const d = new Date(oggi + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

export function oraItalia(): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
}

const dataIT = (iso: string) => iso.split('-').reverse().join('/');
const nomeCamera = (s: Struttura, id: number) => s.nomi_camere[id] || `Camera ${id}`;
const attiva = (p: Prenotazione) => p.stato !== 'cancellata';

// ─── Avvisi alla struttura ──────────────────────────────────────────────────

export interface Esito {
  struttura: string;
  prenotazione?: string;
  ospite?: string;
  esito: 'inviato' | 'errore' | 'in_attesa' | 'saltato';
  dettaglio?: string;
  avviso?: 'inviato' | 'non_inviato' | 'gia_inviato';
}

/** Avviso mostrato nel banner dell'app (components/AvvisiAutomazioni) finché il titolare non lo chiude */
export interface AvvisoApp {
  id: string;
  struttura: string;
  operazione: string;
  ospite: string;
  errore: string;
  creato: string;
}

const whatsappConfigurato = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);

/**
 * Avviso di errore: sempre salvato per il banner dell'app (tabella impostazioni, tipo 'avviso_app');
 * in più WhatsApp al numero della struttura, se Twilio è configurato. L'esito riguarda il WhatsApp.
 */
async function avvisaStruttura(
  s: Struttura, operazione: string, p: Prenotazione | null, errore: string,
): Promise<Esito['avviso']> {
  const ospite = p
    ? `${p.ospite_nome || 'senza nome'} · check-in ${dataIT(p.check_in)} → ${dataIT(p.check_out)} · ${nomeCamera(s, p.camera_id)}`
      + ` · tel ${p.ospite_telefono || '-'} · email ${p.ospite_email || '-'}`
    : '-';
  const id = `${dataItalia(0)}:${p?.id ?? s.id}`;
  const avviso: AvvisoApp = { id, struttura: s.nome, operazione, ospite, errore, creato: new Date().toISOString() };
  await sql`
    INSERT INTO impostazioni (tipo, chiave, valore) VALUES ('avviso_app', ${id}, ${JSON.stringify(avviso)})
    ON CONFLICT (tipo, chiave) DO UPDATE SET valore = EXCLUDED.valore
  `;

  if (!whatsappConfigurato() || !s.telefono.trim()) return 'non_inviato';
  const testo = `⚠️ ${s.nome}: ${operazione} non riuscito\nOspite: ${ospite}\nErrore: ${errore}\n\nApri l'app per correggere.`;
  try {
    await inviaWhatsAppModello(s.telefono, process.env.TWILIO_CONTENT_SID_AVVISO, [s.nome, operazione, ospite, errore], testo);
  } catch (e) {
    console.error(`[automazioni] ${s.nome}: avviso WhatsApp non inviato —`, e instanceof Error ? e.message : e);
    return 'non_inviato';
  }
  return 'inviato';
}

export async function leggiAvvisiApp(): Promise<AvvisoApp[]> {
  const rows = await sql`SELECT valore FROM impostazioni WHERE tipo = 'avviso_app' ORDER BY chiave DESC LIMIT 50`;
  return rows.map(r => JSON.parse(r.valore as string) as AvvisoApp);
}

export async function chiudiAvvisoApp(id: string): Promise<void> {
  await sql`DELETE FROM impostazioni WHERE tipo = 'avviso_app' AND chiave = ${id}`;
}

// ─── Schedine ad AlloggiatiWeb ──────────────────────────────────────────────

/**
 * Invia le schedine degli arrivi di oggi non ancora inviate, una prenotazione per volta.
 * Al tentativo non finale (15:00) chi non si è ancora registrato si aspetta e gli errori non si notificano;
 * al tentativo finale (21:00) ogni problema rimasto diventa un avviso alla struttura.
 */
export async function inviaPortaleAutomatico(finale: boolean): Promise<Esito[]> {
  const esiti: Esito[] = [];
  const oggi = dataItalia(0);
  const operazione = 'Invio schedine Alloggiati Web';

  for (const s of await leggiStrutture()) {
    if (!s.automazioni.portale) continue;
    const arrivi = (await leggiPrenotazioni(s.id)).filter(p => attiva(p) && p.check_in === oggi);
    const alloggiati = await leggiAlloggiati(s.id, oggi);
    if (arrivi.length === 0 && alloggiati.length === 0) continue;

    const creds = s.alloggiati_credentials;
    if (!creds?.utente || !creds?.password || !creds?.wskey) {
      const errore = 'credenziali Alloggiati Web non configurate (Impostazioni → Strutture)';
      const avviso = finale ? await avvisaStruttura(s, operazione, null, `${errore}; arrivi di oggi: ${arrivi.map(p => p.ospite_nome).join(', ') || '-'}`) : undefined;
      esiti.push({ struttura: s.nome, esito: finale ? 'errore' : 'in_attesa', dettaglio: errore, avviso });
      continue;
    }

    // Gruppi da inviare: uno per prenotazione, più gli ospiti inseriti a mano senza prenotazione
    const idsArrivi = new Set(arrivi.map(p => p.id));
    const gruppi: { p: Prenotazione | null; ospiti: Alloggiato[] }[] = arrivi.map(p => ({
      p, ospiti: alloggiati.filter(a => a.prenotazione_id === p.id),
    }));
    const senzaPrenotazione = alloggiati.filter(a => !a.prenotazione_id || !idsArrivi.has(a.prenotazione_id));
    if (senzaPrenotazione.length) gruppi.push({ p: null, ospiti: senzaPrenotazione });

    for (const { p, ospiti } of gruppi) {
      const base = { struttura: s.nome, prenotazione: p?.id, ospite: p?.ospite_nome ?? ospiti.map(a => `${a.nome} ${a.cognome}`).join(', ') };
      const daInviare = ospiti.filter(a => !a.inviato_portale_at);
      if (ospiti.length > 0 && daInviare.length === 0) continue; // già inviate

      if (ospiti.length === 0) {
        if (!finale) { esiti.push({ ...base, esito: 'in_attesa', dettaglio: 'ospite non ancora registrato' }); continue; }
        const avviso = await avvisaStruttura(s, operazione, p, 'l\'ospite non ha registrato i documenti: inseriscili in Alloggiati e invia a mano entro 24 ore dall\'arrivo');
        esiti.push({ ...base, esito: 'errore', dettaglio: 'ospite non registrato', avviso });
        continue;
      }

      const esito = await inviaSchedinePortale(creds, daInviare);
      if (esito.ok) {
        await marcaInviatiPortale(esito.inviati);
        esiti.push({ ...base, esito: 'inviato', dettaglio: `${esito.valide} schedine` });
      } else if (!finale) {
        esiti.push({ ...base, esito: 'in_attesa', dettaglio: esito.errore });
      } else {
        const avviso = await avvisaStruttura(s, operazione, p, esito.errore);
        esiti.push({ ...base, esito: 'errore', dettaglio: esito.errore, avviso });
      }
    }
  }
  return esiti;
}
