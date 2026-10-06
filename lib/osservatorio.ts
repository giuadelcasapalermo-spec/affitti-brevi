// Invio dei movimenti ospiti all'Osservatorio Turistico della Regione Siciliana (Turist@t), per le statistiche ISTAT.
// Protocollo "Property Management System con Sistema Informativo Osservatorio Turistico", rev. 1.0.7 (03/04/2025):
//   login (GET, header UserId/Password) → token; arrivi: stay/addfrompms; modifiche e partenze: stay/updatefrompms
//   (soggiorno completo, Checkout=true per chi è partito); fine giornata: entity/enddayfrompms, ogni giorno anche
//   senza movimenti. Credenziali e codice struttura sono rilasciati dall'Osservatorio per i gestionali (non quelle del portale).
// Lanciato ogni sera da /api/cron/automazioni (azione "osservatorio") o a mano da Impostazioni → Camere → Check-in.
import sql from './postgres';
import type { Alloggiato, Prenotazione, Struttura, OsservatorioCredentials } from './types';
import { leggiStrutture, credenzialiOsservatorio } from './strutture';
import { leggiPrenotazioni } from './db';
import { leggiAlloggiatiDaComunicare, marcaInviatiOsservatorio } from './alloggiati-db';
import { codiciOspite, preparaBatchPerPortale } from './alloggiati';
import { avvisaStruttura, dataItalia, type Esito } from './automazioni';

const BASE = 'https://osservatorioturistico.regione.sicilia.it/webapi/api';
const OPERAZIONE = 'Invio all\'Osservatorio Turistico';
/** Arrivi più vecchi di così non si cercano più (partenze mai comunicate restano da sistemare a mano sul portale) */
const GIORNI_INDIETRO = 60;
/** Chiusure giornaliere mancate che si recuperano al massimo */
const GIORNI_RECUPERO_CHIUSURA = 7;

const ITALIA = '100000100';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function aggiungiGiorni(iso: string, giorni: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

/** Date in UTC come negli esempi del protocollo (ora fissa: conta solo il giorno) */
const utc = (iso: string) => `${iso}T10:00:00.000Z`;

/** Data in formato AAAA-MM-GG anche se salvata come GG/MM/AAAA */
function isoData(v: string): string {
  const s = (v ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

function eta(nascita: string, arrivo: string): number | null {
  const n = isoData(nascita), a = isoData(arrivo);
  if (!n || !a) return null;
  const [ny, nm, nd] = n.split('-').map(Number);
  const [ay, am, ad] = a.split('-').map(Number);
  const anni = ay - ny - (am < nm || (am === nm && ad < nd) ? 1 : 0);
  return anni >= 0 && anni <= 150 ? anni : null;
}

// ─── Comunicazione ──────────────────────────────────────────────────────────

export interface Sessione { utente: string; token: string }

export async function login(c: OsservatorioCredentials): Promise<Sessione> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'GET',
    headers: { UserId: c.utente, Password: c.password, Accept: 'application/xml' },
    signal: AbortSignal.timeout(30000),
  });
  const corpo = (await res.text()).trim();
  if (!res.ok) throw new Error(`accesso rifiutato (HTTP ${res.status})${corpo ? `: ${corpo.slice(0, 200)}` : ''}`);
  // Il token è nell'header Authorization ("Bearer …") e nel corpo tra virgolette
  const header = res.headers.get('authorization');
  const token = header || (corpo ? `Bearer ${corpo.replace(/^"|"$/g, '')}` : '');
  if (!token) throw new Error('accesso riuscito ma token assente nella risposta');
  return { utente: c.utente, token };
}

export async function logout(s: Sessione): Promise<void> {
  await fetch(`${BASE}/auth/logout`, {
    method: 'POST',
    headers: { UserId: s.utente, Authorization: s.token },
    signal: AbortSignal.timeout(15000),
  }).catch(() => {});
}

/** Errori leggibili dalla risposta (ArrayOfValidationResultDTO): IsValid=false e messaggi di livello Error */
function erroriValidazione(xml: string): string[] {
  const errori: string[] = [];
  const re = /<ValidationMessageDTO>([\s\S]*?)<\/ValidationMessageDTO>/g;
  const tag = (b: string, t: string) => b.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`))?.[1]?.trim() ?? '';
  let m;
  while ((m = re.exec(xml)) !== null) {
    const livello = tag(m[1], 'Level');
    if (livello && livello !== 'Error') continue;
    const campo = tag(m[1], 'FieldName');
    const valore = tag(m[1], 'FieldValue');
    errori.push(`${tag(m[1], 'Message')}${campo ? ` (${campo}${valore ? ` = ${valore}` : ''})` : ''}`);
  }
  if (!errori.length && /<IsValid>false<\/IsValid>/i.test(xml)) errori.push('dati rifiutati dall\'Osservatorio');
  return errori;
}

async function invia(s: Sessione, percorso: string, xml: string): Promise<void> {
  const res = await fetch(`${BASE}/${percorso}`, {
    method: 'POST',
    headers: { Authorization: s.token, 'Content-Type': 'text/xml; charset=utf-8', Accept: 'application/xml' },
    body: xml,
    signal: AbortSignal.timeout(30000),
  });
  const corpo = await res.text();
  const errori = erroriValidazione(corpo);
  if (!res.ok || errori.length) {
    throw new Error(errori.length ? errori.join('; ') : `HTTP ${res.status}${corpo ? `: ${corpo.slice(0, 200)}` : ''}`);
  }
}

// ─── Messaggi ───────────────────────────────────────────────────────────────

interface OspiteStay { a: Alloggiato; tipo: string; checkout: boolean }

/** Dati di un ospite per il protocollo, o l'elenco di ciò che manca */
function datiOspite(a: Alloggiato): { errori: string[]; eta: number; cittadinanza: string; nascita: string; residenza: string } {
  const c = codiciOspite(a);
  const errori: string[] = [];
  const anni = eta(a.data_nascita, a.data_arrivo);
  if (anni === null) errori.push('data di nascita mancante o non valida');
  if (!/^\d{9}$/.test(c.cittadinanza)) errori.push('cittadinanza non riconosciuta');
  if (!/^\d{9}$/.test(c.luogoNascita)) errori.push('luogo di nascita non riconosciuto');
  // Residenza non raccolta: stranieri → Stato di cittadinanza; italiani → comune (o Stato) di nascita
  const residenza = c.cittadinanza && c.cittadinanza !== ITALIA ? c.cittadinanza : c.luogoNascita;
  return { errori, eta: anni ?? 0, cittadinanza: c.cittadinanza, nascita: c.luogoNascita, residenza };
}

export function xmlStay(stayId: string, codice: string, cameraId: string, ospiti: OspiteStay[]): string {
  const guests = ospiti.map(({ a, tipo, checkout }) => {
    const d = datiOspite(a);
    const arrivo = isoData(a.data_arrivo);
    const partenza = aggiungiGiorni(arrivo, Math.max(1, a.permanenza));
    return `<Guest>`
      + `<GuestId>${esc(a.id)}</GuestId>`
      + `<Age>${d.eta}</Age>`
      + `<NationalityCode>${d.cittadinanza}</NationalityCode>`
      + `<BirthPlaceCode>${d.nascita}</BirthPlaceCode>`
      + `<ResidencePlaceCode>${d.residenza}</ResidencePlaceCode>`
      + `<Type>${tipo}</Type>`
      + `<Gender>${a.sesso === 'F' ? 2 : 1}</Gender>`
      + `<EMail></EMail>`
      + `<ArrivalDate>${utc(arrivo)}</ArrivalDate>`
      + `<DepartureDate>${utc(partenza)}</DepartureDate>`
      + `<Checkout>${checkout}</Checkout>`
      + `<BedOccupancy>true</BedOccupancy>`
      + `<Rooms><Room><RoomId>${esc(cameraId)}</RoomId><StartDate>${utc(arrivo)}</StartDate><EndDate>${utc(partenza)}</EndDate></Room></Rooms>`
      + `</Guest>`;
  }).join('');
  return `<?xml version="1.0" encoding="utf-8"?><StaysPmsDTO><Stay>`
    // Ordine dello schema XSD (HotelCode, StayId, Guests); gli esempi del documento li invertono
    + `<HotelCode>${esc(codice)}</HotelCode><StayId>${esc(stayId)}</StayId><Guests>${guests}</Guests>`
    + `</Stay></StaysPmsDTO>`;
}

const xmlFineGiornata = (codice: string, data: string) =>
  `<?xml version="1.0" encoding="utf-8"?><EndDayPmsDTO><HotelCode>${esc(codice)}</HotelCode><CurrentDate>${utc(data)}</CurrentDate></EndDayPmsDTO>`;

// ─── Invio per struttura ────────────────────────────────────────────────────

/** Prova le credenziali (solo login/logout): usato dal pulsante "Prova connessione" */
export async function provaCredenziali(c: OsservatorioCredentials): Promise<void> {
  const s = await login(c);
  await logout(s);
}

async function ultimaChiusura(codice: string): Promise<string | null> {
  const rows = await sql`SELECT valore FROM impostazioni WHERE tipo = 'osservatorio_chiusura' AND chiave = ${codice}`;
  return (rows[0]?.valore as string | undefined) ?? null;
}

async function salvaChiusura(codice: string, data: string): Promise<void> {
  await sql`
    INSERT INTO impostazioni (tipo, chiave, valore) VALUES ('osservatorio_chiusura', ${codice}, ${data})
    ON CONFLICT (tipo, chiave) DO UPDATE SET valore = EXCLUDED.valore
  `;
}

/**
 * Comunica all'Osservatorio arrivi e partenze fino a `oggi` e chiude la giornata, per ogni codice struttura
 * (della struttura e delle camere con credenziali proprie). Gli errori diventano avvisi nell'app.
 */
export async function inviaOsservatorioStruttura(s: Struttura, oggi = dataItalia(0)): Promise<Esito[]> {
  const esiti: Esito[] = [];
  const prenotazioni = await leggiPrenotazioni(s.id);
  const perId = new Map(prenotazioni.map(p => [p.id, p]));
  const alloggiati = (await leggiAlloggiatiDaComunicare(s.id, aggiungiGiorni(oggi, -GIORNI_INDIETRO)))
    .filter(a => isoData(a.data_arrivo) && isoData(a.data_arrivo) <= oggi)
    // Prenotazioni cancellate dopo la registrazione: non sono soggiorni
    .filter(a => !a.prenotazione_id || perId.get(a.prenotazione_id)?.stato !== 'cancellata');

  // Un soggiorno per prenotazione; gli ospiti inseriti a mano senza prenotazione sono soggiorni a sé
  const soggiorni = new Map<string, { p: Prenotazione | null; ospiti: Alloggiato[] }>();
  for (const a of alloggiati) {
    const p = a.prenotazione_id ? perId.get(a.prenotazione_id) ?? null : null;
    const chiave = p ? p.id : `ospite-${a.id}`;
    const g = soggiorni.get(chiave) ?? { p, ospiti: [] };
    g.ospiti.push(a);
    soggiorni.set(chiave, g);
  }

  const sessioni = new Map<string, Sessione>(); // per codice struttura
  const codiciUsati = new Map<string, OsservatorioCredentials>();
  const sessione = async (c: OsservatorioCredentials) => {
    let ses = sessioni.get(c.codice_struttura);
    if (!ses) { ses = await login(c); sessioni.set(c.codice_struttura, ses); }
    return ses;
  };
  // La chiusura giornaliera va mandata per ogni codice configurato, anche senza movimenti
  for (const c of [s.osservatorio_credentials, ...Object.values(s.osservatorio_camere)]) {
    if (c?.utente && c.password && c.codice_struttura) codiciUsati.set(c.codice_struttura, c);
  }

  try {
    for (const [chiave, { p, ospiti }] of soggiorni) {
      const nome = p?.ospite_nome ?? ospiti.map(a => `${a.nome} ${a.cognome}`).join(', ');
      const base = { struttura: s.nome, prenotazione: p?.id, ospite: nome };
      const cameraId = p?.camera_id ?? null;
      const creds = credenzialiOsservatorio(s, cameraId);
      if (!creds) {
        const errore = `credenziali Osservatorio non configurate${cameraId ? ` per la camera ${cameraId}` : ''} (Impostazioni → Strutture)`;
        esiti.push({ ...base, esito: 'errore', dettaglio: errore, avviso: await avvisaStruttura(s, OPERAZIONE, p, errore, 'osservatorio') });
        continue;
      }
      const incompleti = ospiti.map(a => ({ a, e: datiOspite(a).errori })).filter(x => x.e.length);
      if (incompleti.length) {
        const errore = incompleti.map(x => `${x.a.nome} ${x.a.cognome}: ${x.e.join(', ')}`).join(' | ') + ' — correggi la scheda in Alloggiati';
        esiti.push({ ...base, esito: 'errore', dettaglio: errore, avviso: await avvisaStruttura(s, OPERAZIONE, p, errore, 'osservatorio') });
        continue;
      }

      // Tipo alloggiato coerente con le schedine di Alloggiati Web (16 singolo, 18/20 gruppi stranieri)
      const tipi = new Map(preparaBatchPerPortale(ospiti).map(a => [a.id, a.tipo]));
      const stayId = `${creds.codice_struttura}_${chiave}`;
      const camera = cameraId != null ? String(cameraId) : 'ND';
      const partito = (a: Alloggiato) => aggiungiGiorni(isoData(a.data_arrivo), Math.max(1, a.permanenza)) <= oggi;
      try {
        const ses = await sessione(creds);
        const nuovi = ospiti.filter(a => !a.osservatorio_inviato_at);
        if (nuovi.length) {
          // Primo invio del soggiorno → addfrompms; ospiti aggiunti a un soggiorno già comunicato → updatefrompms completo
          const giaComunicato = ospiti.some(a => a.osservatorio_inviato_at);
          const lista = ospiti.map(a => ({ a, tipo: tipi.get(a.id) ?? a.tipo, checkout: false }));
          await invia(ses, giaComunicato ? 'stay/updatefrompms' : 'stay/addfrompms', xmlStay(stayId, creds.codice_struttura, camera, lista));
          await marcaInviatiOsservatorio(nuovi.map(a => a.id), false);
        }
        const partiti = ospiti.filter(partito);
        if (partiti.length) {
          const lista = ospiti.map(a => ({ a, tipo: tipi.get(a.id) ?? a.tipo, checkout: partito(a) }));
          await invia(ses, 'stay/updatefrompms', xmlStay(stayId, creds.codice_struttura, camera, lista));
          await marcaInviatiOsservatorio(partiti.map(a => a.id), true);
        }
        if (nuovi.length || partiti.length) {
          esiti.push({ ...base, esito: 'inviato', dettaglio: [nuovi.length && `${nuovi.length} arrivi`, partiti.length && `${partiti.length} partenze`].filter(Boolean).join(', ') });
        }
      } catch (e) {
        const errore = e instanceof Error ? e.message : String(e);
        esiti.push({ ...base, esito: 'errore', dettaglio: errore, avviso: await avvisaStruttura(s, OPERAZIONE, p, errore, 'osservatorio') });
      }
    }

    // Chiusura giornaliera (recupera i giorni mancati, al massimo una settimana)
    for (const [codice, creds] of codiciUsati) {
      const ultima = await ultimaChiusura(codice);
      let giorno = ultima ? aggiungiGiorni(ultima, 1) : oggi;
      const minimo = aggiungiGiorni(oggi, -(GIORNI_RECUPERO_CHIUSURA - 1));
      if (giorno < minimo) giorno = minimo;
      try {
        const ses = await sessione(creds);
        const chiusi: string[] = [];
        for (; giorno <= oggi; giorno = aggiungiGiorni(giorno, 1)) {
          await invia(ses, 'entity/enddayfrompms', xmlFineGiornata(codice, giorno));
          await salvaChiusura(codice, giorno);
          chiusi.push(giorno);
        }
        esiti.push({ struttura: s.nome, ospite: codice, esito: chiusi.length ? 'inviato' : 'saltato', dettaglio: chiusi.length ? `chiusura ${chiusi.join(', ')}` : 'giornata già chiusa' });
      } catch (e) {
        const errore = `chiusura giornaliera ${codice}: ${e instanceof Error ? e.message : String(e)}`;
        esiti.push({ struttura: s.nome, ospite: codice, esito: 'errore', dettaglio: errore, avviso: await avvisaStruttura(s, OPERAZIONE, null, errore, 'osservatorio') });
      }
    }
  } finally {
    await Promise.all([...sessioni.values()].map(logout));
  }
  return esiti;
}

/** Tutte le strutture con l'invio all'Osservatorio attivo (cron serale) */
export async function inviaOsservatorioAutomatico(): Promise<Esito[]> {
  const esiti: Esito[] = [];
  for (const s of await leggiStrutture()) {
    if (!s.automazioni.osservatorio) continue;
    esiti.push(...await inviaOsservatorioStruttura(s));
  }
  return esiti;
}
