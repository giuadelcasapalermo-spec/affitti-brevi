// Invii automatici per struttura (attivati in Impostazioni → Camere → Check-in), lanciati da /api/cron/automazioni:
//  · link di registrazione documenti via WhatsApp all'ospite, per gli arrivi entro 4 giorni
//  · schedine ad AlloggiatiWeb il giorno del check-in (tentativo delle 14:00 e finale delle 21:00)
// Gli errori arrivano su WhatsApp al numero della struttura, con i dati dell'ospite.
import { differenceInDays, parseISO } from 'date-fns';
import sql from './postgres';
import type { Prenotazione, Struttura, Alloggiato } from './types';
import { leggiStrutture } from './strutture';
import { leggiPrenotazioni } from './db';
import { creaLink, leggiLinksPerPrenotazioni, testoLinkRegistrazione } from './link-alloggiati';
import { leggiAlloggiati, marcaInviatiPortale } from './alloggiati-db';
import { inviaSchedinePortale } from './portale-alloggiati';
import { inviaWhatsAppModello } from './twilio-send';

/** Giorni prima dell'arrivo da cui parte il link di registrazione */
export const GIORNI_ANTICIPO_LINK = 4;

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

/**
 * WhatsApp di errore al numero della struttura. Con `chiave` l'avviso parte una sola volta
 * (i link si ritentano ogni giorno finché l'ospite non ha un telefono).
 */
async function avvisaStruttura(
  s: Struttura, operazione: string, p: Prenotazione | null, errore: string, chiave?: string,
): Promise<Esito['avviso']> {
  if (chiave) {
    const gia = await sql`SELECT 1 FROM impostazioni WHERE tipo = 'avviso_auto' AND chiave = ${chiave}`;
    if (gia.length > 0) return 'gia_inviato';
  }
  if (!s.telefono.trim()) {
    console.error(`[automazioni] ${s.nome}: telefono della struttura mancante, avviso non inviato — ${operazione}: ${errore}`);
    return 'non_inviato';
  }
  const ospite = p
    ? `${p.ospite_nome || 'senza nome'} · check-in ${dataIT(p.check_in)} → ${dataIT(p.check_out)} · ${nomeCamera(s, p.camera_id)}`
      + ` · tel ${p.ospite_telefono || '-'} · email ${p.ospite_email || '-'}`
    : '-';
  const testo = `⚠️ ${s.nome}: ${operazione} non riuscito\nOspite: ${ospite}\nErrore: ${errore}\n\nApri l'app per correggere.`;
  try {
    await inviaWhatsAppModello(s.telefono, process.env.TWILIO_CONTENT_SID_AVVISO, [s.nome, operazione, ospite, errore], testo);
  } catch (e) {
    console.error(`[automazioni] ${s.nome}: avviso WhatsApp non inviato —`, e instanceof Error ? e.message : e);
    return 'non_inviato';
  }
  if (chiave) {
    await sql`
      INSERT INTO impostazioni (tipo, chiave, valore) VALUES ('avviso_auto', ${chiave}, ${new Date().toISOString()})
      ON CONFLICT (tipo, chiave) DO NOTHING
    `;
  }
  return 'inviato';
}

// ─── Link di registrazione ──────────────────────────────────────────────────

/** Per gli arrivi da domani a +4 giorni senza link: crea il link e lo invia su WhatsApp all'ospite */
export async function inviaLinkAutomatici(): Promise<Esito[]> {
  const esiti: Esito[] = [];
  const dal = dataItalia(1);
  const al = dataItalia(GIORNI_ANTICIPO_LINK);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://affittibrevi.vercel.app';

  for (const s of await leggiStrutture()) {
    if (!s.automazioni.link_whatsapp) continue;
    const arrivi = (await leggiPrenotazioni(s.id)).filter(p => attiva(p) && p.check_in >= dal && p.check_in <= al);
    const links = await leggiLinksPerPrenotazioni(arrivi.map(p => p.id));

    for (const p of arrivi) {
      if (links[p.id]) continue; // link già creato (anche a mano): non si reinvia
      const base = { struttura: s.nome, prenotazione: p.id, ospite: p.ospite_nome };
      if (!p.ospite_telefono.trim()) {
        const avviso = await avvisaStruttura(s, 'Invio link di registrazione', p,
          'telefono dell\'ospite mancante: inseriscilo nella prenotazione, il link partirà al prossimo invio automatico', `link_tel:${p.id}`);
        esiti.push({ ...base, esito: 'saltato', dettaglio: 'telefono ospite mancante', avviso });
        continue;
      }
      const permanenza = Math.max(1, differenceInDays(parseISO(p.check_out), parseISO(p.check_in)));
      const token = await creaLink({
        prenotazioneId: p.id, strutturaId: s.id, emailOspite: p.ospite_email,
        nomeOspite: p.ospite_nome, dataArrivo: p.check_in, permanenza,
      });
      const url = `${baseUrl}/registrazione/${token}`;
      try {
        await inviaWhatsAppModello(p.ospite_telefono, process.env.TWILIO_CONTENT_SID_LINK,
          [p.ospite_nome, s.nome, dataIT(p.check_in), url], testoLinkRegistrazione(p.ospite_nome, s.nome, p.check_in, url));
        esiti.push({ ...base, esito: 'inviato' });
      } catch (e) {
        // Il link non è arrivato: lo si elimina, così il prossimo giro ritenta
        await sql`DELETE FROM link_alloggiati WHERE token = ${token}`;
        const errore = e instanceof Error ? e.message : String(e);
        const avviso = await avvisaStruttura(s, 'Invio link di registrazione', p, errore, `link_err:${p.id}`);
        esiti.push({ ...base, esito: 'errore', dettaglio: errore, avviso });
      }
    }
  }
  return esiti;
}

// ─── Schedine ad AlloggiatiWeb ──────────────────────────────────────────────

/**
 * Invia le schedine degli arrivi di oggi non ancora inviate, una prenotazione per volta.
 * Al tentativo non finale (14:00) chi non si è ancora registrato si aspetta e gli errori non si notificano;
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
