import { Alloggiato } from './types';
import { nomePaeseACodice, nomePaeseACodiciCittadinanza, aggettivoCittadinanzaACodice, codiceStatoNascita } from './codici-alloggiati';
import { nomeACodiceComune, COMUNI } from './comuni-italiani';

// Re-export CRUD dal modulo leggero: le rotte che fanno solo DB import da lì direttamente.
export { leggiAlloggiati, creaAlloggiato, aggiornaAlloggiato, eliminaAlloggiato } from './alloggiati-db';

function pad(str: string, len: number): string {
  return str.substring(0, len).padEnd(len, ' ');
}

function padLeft(num: number, len: number): string {
  return String(num).padStart(len, ' ');
}

// Caratteri che non si decompongono con NFD: devono essere translitterati esplicitamente.
// ß → SS è già gestito da toUpperCase() in JS moderno.
const TRANSLITERATE_NOMI: Record<string, string> = {
  'Ø': 'O', 'ø': 'O',
  'Ð': 'D', 'ð': 'D', 'Đ': 'D', 'đ': 'D',
  'Þ': 'TH', 'þ': 'TH',
  'Æ': 'AE', 'æ': 'AE',
  'Œ': 'OE', 'œ': 'OE',
  'Ł': 'L', 'ł': 'L',
  'Ŋ': 'N', 'ŋ': 'N',
  'Ħ': 'H', 'ħ': 'H',
};

// Normalizza cognome/nome in ASCII 7-bit per il formato a larghezza fissa del portale.
// Il portale AlloggiatiWeb è un sistema legacy che non gestisce caratteri non-ASCII nei campi nome.
// Esempi: MÜLLER→MULLER, WÖRMANN→WORMANN, FRANÇOIS→FRANCOIS, ØDEGAARD→ODEGAARD.
function normalizzaNome(s: string): string {
  const upper = s.toUpperCase(); // converte anche ß→SS
  const transliterated = [...upper].map(c => TRANSLITERATE_NOMI[c] ?? c).join('');
  return transliterated
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // rimuove diacritici combinanti (Ü→U, é→E, etc.)
    .replace(/[^\x20-\x7E]/g, '')    // rimuove eventuali non-ASCII residui
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDataIT(dateStr: string): string {
  if (!dateStr) return '          ';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr.substring(0, 10);
}

// Converte il valore grezzo (nome paese, vecchio Z-code, o codice 9-cifre) nel codice corretto.
function codicePaeseSanitizzato(raw: string): string {
  const v = (raw ?? '').trim();
  if (!v) return '';
  if (/^\d{9}$/.test(v)) return v;   // già codice 9-cifre (es. 100000100)
  return nomePaeseACodice(v);         // gestisce Z-code legacy, nomi, varianti
}

// Mappa i codici tipo_documento a 2 char nei codici 5-char richiesti dal portale
const TIPO_DOC_MAP: Record<string, string> = {
  // Carte d'identità
  'CI':      'IDELE',   // Carta d'Identità Elettronica (IT)
  'CIE':     'IDELE',   // Carta d'Identità Elettronica
  'IDELE':   'IDELE',
  'ID':      'IDENT',   // Identity card generica (stranieri)
  'IDENT':   'IDENT',
  'IDC':     'IDENT',
  'CARTA':   'IDENT',
  // Passaporti
  'PP':      'PASSE',
  'PASS':    'PASSE',
  'PASSPORT':'PASSE',
  // Patente
  'PA':      'PATEG',
  'PATENTE': 'PATEG',
  'DL':      'PATEG',   // Driver's License
};

function tipoDocumentoSanitizzato(raw: string): string {
  const v = (raw ?? '').trim().toUpperCase();
  if (v.length === 5) return v;                      // già nel formato corretto
  return TIPO_DOC_MAP[v] ?? raw.substring(0, 5).padEnd(5, ' ');
}

const TIPO_SORT: Record<string, number> = { '17': 0, '16': 1, '20': 2, '18': 3, '19': 4 };

export function preparaBatchPerPortale(alloggiati: Alloggiato[]): Alloggiato[] {
  // Raggruppa per prenotazione
  const gruppi = new Map<string, Alloggiato[]>();
  for (const a of alloggiati) {
    const key = a.prenotazione_id ?? '';
    if (!gruppi.has(key)) gruppi.set(key, []);
    gruppi.get(key)!.push(a);
  }

  const result: Alloggiato[] = [];

  for (const gruppo of gruppi.values()) {
    if (gruppo.length === 1) {
      // Ospite singolo: tipo 16 è l'unico tipo standalone accettato dal portale.
      // Tipo 17 e 18 richiedono ospiti a seguire; tipo 19 e 20 richiedono un capo precedente.
      result.push({ ...gruppo[0], tipo: '16' as Alloggiato['tipo'] });
      continue;
    }

    // Gruppo multi-ospite: distingui italiani (17+16) da stranieri (18+19)
    let g = [...gruppo];
    const primoStato = codicePaeseSanitizzato(g[0].stato_nascita);
    const isGruppoItaliano = !primoStato || primoStato === '100000100';

    if (isGruppoItaliano) {
      // Gruppo italiano: tipo 17 (capo) + tipo 16 (membri)
      if (!g.some(a => a.tipo === '17')) {
        const idx = g.findIndex(a => a.tipo !== '17');
        g = g.map((a, i) => i === idx ? { ...a, tipo: '17' as Alloggiato['tipo'] } : { ...a, tipo: '16' as Alloggiato['tipo'] });
      }
    } else {
      // Gruppo straniero: tipo 18 (capo) + tipo 19 (membri)
      const headIdx = g.findIndex(a => a.tipo === '18') >= 0 ? g.findIndex(a => a.tipo === '18') : 0;
      g = g.map((a, i) => i === headIdx ? { ...a, tipo: '18' as Alloggiato['tipo'] } : { ...a, tipo: '19' as Alloggiato['tipo'] });
    }

    g.sort((a, b) => (TIPO_SORT[a.tipo] ?? 99) - (TIPO_SORT[b.tipo] ?? 99));
    result.push(...g);
  }

  return result;
}

export function generaFileAlloggiati(alloggiati: Alloggiato[]): string {
  const righe = alloggiati.map(a => {
    const tipo = pad(a.tipo, 2);
    const dataArrivo = formatDataIT(a.data_arrivo);
    const permanenza = padLeft(a.permanenza, 2);
    const cognome = pad(normalizzaNome(a.cognome), 50);
    const nome = pad(normalizzaNome(a.nome), 30);
    const sesso = a.sesso === 'F' ? '2' : '1';
    const dataNascita = formatDataIT(a.data_nascita);

    const statoNascitaCode = codicePaeseSanitizzato(a.stato_nascita);

    // Cittadinanza: se vuota nel DB, usa stato_nascita come fallback per stranieri
    const rawCitt = (a.cittadinanza ?? '').trim();
    const cittadinanzaCode = /^\d{9}$/.test(rawCitt) ? rawCitt
      : aggettivoCittadinanzaACodice(rawCitt) || codicePaeseSanitizzato(rawCitt)
        || (statoNascitaCode && statoNascitaCode !== '100000100' ? statoNascitaCode : '') || '';
    const cittadinanza = pad(cittadinanzaCode, 9);
    // Nato in Italia: stato = 100000100, comune = codice ISTAT, provincia = 2 char
    // Nato all'estero: stato = codice paese, comune = codice paese, provincia = "EE"
    const isBornInItaly = !statoNascitaCode || statoNascitaCode === '100000100';

    let comuneNascita: string;
    let provinciaNascita: string;
    let statoNascita: string;

    if (isBornInItaly) {
      const comuneNascitaClean = a.comune_nascita.trim().replace(/\s*\([A-Z]{1,3}\)\s*$/i, '').trim();
      const rawComune = /^\d{9}$/.test(a.comune_nascita.trim())
        ? a.comune_nascita.trim()
        : nomeACodiceComune(comuneNascitaClean) || nomeACodiceComune(a.comune_nascita) || '';

      if (rawComune) {
        statoNascita = pad('100000100', 9);
        comuneNascita = pad(rawComune, 9);
        const provRaw = (a.provincia_nascita?.trim() || COMUNI.find(c => c.codice === rawComune.trim())?.prov || '').toUpperCase();
        provinciaNascita = pad(provRaw, 2);
      } else {
        // stato_nascita = Italia ma comune non trovato (dato errato o straniero):
        // usa cittadinanza come paese di nascita con prov "EE"
        const fallback = cittadinanzaCode || '100000100';
        statoNascita = pad(fallback, 9);
        comuneNascita = pad(fallback, 9);
        provinciaNascita = pad('EE', 2);
      }
    } else {
      statoNascita = pad(statoNascitaCode, 9);
      // Per stranieri nati all'estero: comune = codice paese, provincia = "EE"
      comuneNascita = pad(statoNascitaCode, 9);
      provinciaNascita = pad('EE', 2);
    }
    const tipoDocumento = tipoDocumentoSanitizzato(a.tipo_documento);
    const numeroDocumento = pad(a.numero_documento, 20);

    // Luogo rilascio: codice ISTAT comune (italiani) o codice paese (stranieri/nati all'estero)
    const luogoRilascioClean = (a.luogo_rilascio ?? '').trim().replace(/\s*\([A-Z]{1,3}\)\s*$/i, '').trim();
    const rawLuogoResolved = /^\d{9}$/.test((a.luogo_rilascio ?? '').trim())
      ? a.luogo_rilascio.trim()
      : nomeACodiceComune(luogoRilascioClean) || nomeACodiceComune(a.luogo_rilascio) || '';
    const luogoRilascio = pad(
      rawLuogoResolved || (isBornInItaly ? comuneNascita.trim() : statoNascitaCode),
      9
    );

    return `${tipo}${dataArrivo}${permanenza}${cognome}${nome}${sesso}${dataNascita}${comuneNascita}${provinciaNascita}${statoNascita}${cittadinanza}${tipoDocumento}${numeroDocumento}${luogoRilascio}`;
  });
  return righe.join('\r\n');
}

export interface ErroreValidazione {
  indice: number;
  ospite: string;
  errori: string[];
}

// Valida un batch prima dell'invio al portale. Restituisce errori per ogni ospite con dati mancanti
// o non risolvibili, con messaggi in italiano pensati per essere mostrati direttamente all'utente.
export function validaBatch(alloggiati: Alloggiato[]): ErroreValidazione[] {
  const problemi: ErroreValidazione[] = [];
  for (let i = 0; i < alloggiati.length; i++) {
    const a = alloggiati[i];
    const errori: string[] = [];
    const ospite = [a.cognome, a.nome].filter(Boolean).join(' ').trim() || `[ospite ${i + 1}]`;

    if (!a.cognome.trim()) errori.push('Cognome mancante');
    if (!a.nome.trim()) errori.push('Nome mancante');
    if (!a.data_nascita) errori.push('Data di nascita mancante');
    if (!a.tipo_documento.trim()) {
      errori.push('Tipo documento mancante (es. PP, CI, PASSE, IDELE)');
    } else {
      const docCode = tipoDocumentoSanitizzato(a.tipo_documento);
      const CODICI_VALIDI = new Set(['PASSE','IDELE','IDENT','PATEG','CARTA','PASOR','DOGOR','FOGLIO']);
      if (!CODICI_VALIDI.has(docCode.trim())) {
        errori.push(`Tipo documento non riconosciuto: "${a.tipo_documento}" — usa PP, CI, ID, PASSE, IDELE o IDENT`);
      }
    }
    if (!a.numero_documento.trim()) errori.push('Numero documento mancante');

    const statoCode = codicePaeseSanitizzato(a.stato_nascita);
    const isBornAbroad = statoCode && statoCode !== '100000100';

    if (!isBornAbroad) {
      // Nato in Italia: deve risolvere il comune di nascita
      const comuneClean = a.comune_nascita.trim().replace(/\s*\([A-Z]{1,3}\)\s*$/i, '').trim();
      const comuneCode = /^\d{9}$/.test(a.comune_nascita.trim())
        ? a.comune_nascita.trim()
        : nomeACodiceComune(comuneClean) || nomeACodiceComune(a.comune_nascita);
      if (!comuneCode) {
        errori.push(
          a.comune_nascita.trim()
            ? `Comune di nascita non trovato: "${a.comune_nascita}" — verifica la grafia o inserisci il codice ISTAT`
            : 'Comune di nascita mancante'
        );
      }
    } else if (!statoCode) {
      errori.push(
        a.stato_nascita.trim()
          ? `Stato di nascita non riconosciuto: "${a.stato_nascita}" — usa il nome in italiano (es. "GERMANIA") o il codice 9 cifre`
          : 'Stato di nascita mancante'
      );
    }

    // Cittadinanza: il generatore usa stato_nascita come fallback, quindi segnala solo se entrambi mancano
    const rawCitt = (a.cittadinanza ?? '').trim();
    const cittCode = /^\d{9}$/.test(rawCitt) ? rawCitt
      : aggettivoCittadinanzaACodice(rawCitt) || codicePaeseSanitizzato(rawCitt)
        || (statoCode && statoCode !== '100000100' ? statoCode : '');
    if (!cittCode) {
      errori.push(
        rawCitt
          ? `Cittadinanza non riconosciuta: "${a.cittadinanza}" — usa aggettivo (es. "ITALIANA", "TEDESCA") o codice (es. "100000216")`
          : 'Cittadinanza mancante (e stato di nascita non risolvibile come fallback)'
      );
    }

    if (errori.length > 0) problemi.push({ indice: i, ospite, errori });
  }
  return problemi;
}
