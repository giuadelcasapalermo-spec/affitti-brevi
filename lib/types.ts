export interface Camera {
  id: number;
  nome: string;
  prezzo_notte: number;
  colore?: string;
}

export interface AlloggiatiCredentials {
  utente: string;
  password: string;
  wskey: string;
}

export type TipoContoCorrente = 'contanti' | 'pos' | 'bonifico' | 'altro';

export interface ContoCorrente {
  id: string;
  tipo: TipoContoCorrente;
  nome: string;
}

export const TIPI_CONTO: Record<TipoContoCorrente, string> = {
  contanti: 'Contanti',
  pos:      'POS',
  bonifico: 'Bonifico',
  altro:    'Altro',
};

export interface BookingChannelManagerConfig {
  /** URL dove gira il channel manager (es. http://localhost:3001 o https://…) */
  channel_manager_url: string;
  /** Hotel ID su Booking.com */
  hotel_id: string;
  /** Machine account username (connect.booking.com) */
  username: string;
  /** Machine account password */
  password: string;
  /** Segreto HMAC per i webhook push (opzionale) */
  webhook_secret?: string;
  /** Mappa camera_id affitti-brevi → room_id channel manager */
  room_id_map: Record<number, string>;
}

export interface DatiFiscali {
  ragione_sociale: string;
  partita_iva: string;
  codice_fiscale: string;
  sede_legale: string;
  pec: string;
  /** Codice Identificativo Nazionale (BDSR, Ministero del Turismo) */
  cin: string;
  /** Codice identificativo regionale (CIR/CIS/CITR a seconda della regione) */
  cir: string;
  tipologia: string;
}

export interface RegoleStruttura {
  comune: string;
  /** Notti massime soggette a tassa di soggiorno per singolo soggiorno */
  tassa_max_notti: number;
  /** Tariffa per persona per notte (€), solo informativa */
  tassa_tariffa: number;
  costo_pulizia_checkout: number;
  costo_cambio_stanza: number;
}

// Valori in uso prima della configurazione per struttura (Palermo)
export const REGOLE_DEFAULT: RegoleStruttura = {
  comune: '',
  tassa_max_notti: 4,
  tassa_tariffa: 0,
  costo_pulizia_checkout: 7,
  costo_cambio_stanza: 4,
};

export const DATI_FISCALI_VUOTI: DatiFiscali = {
  ragione_sociale: '', partita_iva: '', codice_fiscale: '', sede_legale: '',
  pec: '', cin: '', cir: '', tipologia: '',
};

export interface Struttura {
  id: string;
  nome: string;
  indirizzo: string;
  num_camere: number;
  nomi_camere: Record<number, string>;
  prezzi_camere: Record<number, number>;
  colori_camere: Record<number, string>;
  ical_urls: Record<number, string>;
  alloggiati_credentials?: AlloggiatiCredentials;
  conti_correnti: ContoCorrente[];
  channel_manager_config?: BookingChannelManagerConfig;
  dati_fiscali: DatiFiscali;
  regole: RegoleStruttura;
  /** Modello del messaggio di check-in; segnaposto: {ospite} {camera} {tassa} {indirizzo} {struttura} */
  istruzioni_checkin: string;
  /** Numero WhatsApp della struttura: riceve gli avvisi di errore delle automazioni */
  telefono: string;
  automazioni: AutomazioniStruttura;
  created_at: string;
}

/** Invii automatici (cron /api/cron/automazioni), spenti finché il titolare non li attiva */
export interface AutomazioniStruttura {
  /** Invio delle schedine ad Alloggiati Web il giorno del check-in (15:00 e 21:00) */
  portale: boolean;
}

export const AUTOMAZIONI_DEFAULT: AutomazioniStruttura = { portale: false };

export interface Prenotazione {
  id: string;
  struttura_id?: string;
  camera_id: number;
  ospite_nome: string;
  ospite_telefono: string;
  ospite_email: string;
  check_in: string;
  check_out: string;
  importo_totale: number;
  tassa_soggiorno?: number;
  tassa_esenti?: number;
  tassa_trovata?: number | null;
  stato: 'confermata' | 'pending' | 'cancellata';
  note: string;
  created_at: string;
  fonte: 'manuale' | 'ical' | 'sheet' | 'booking';
  ical_uid?: string;
}

export const CATEGORIE_USCITA = [
  'Pulizie',
  'Lavanderia',
  'Utenze',
  'Manutenzione',
  'Forniture',
  'Arredamento',
  'Commissioni',
  'Tasse',
  'Pubblicità',
  'Affitto',
  'Altro',
] as const;

export type CategoriaUscita = typeof CATEGORIE_USCITA[number];

export interface Uscita {
  id: string;
  data: string;
  descrizione: string;
  categoria: CategoriaUscita;
  importo: number;
  camera_id?: number;
  note: string;
  fonte_pagamento: string;
  created_at: string;
}

export const CATEGORIE_ENTRATA = [
  'Booking.com',
  'Airbnb',
  'Privato',
  'Tasse',
  'Altro',
] as const;

export type CategoriaEntrata = typeof CATEGORIE_ENTRATA[number];

export interface Entrata {
  id: string;
  data: string;
  descrizione: string;
  categoria: CategoriaEntrata;
  importo: number;
  camera_id?: number;
  note: string;
  fonte_pagamento: string;
  created_at: string;
}

export interface PrezzoPerPeriodo {
  id: string;
  struttura_id?: string;
  camera_id: number;
  nome_periodo: string;
  data_inizio: string;   // yyyy-MM-dd
  data_fine: string;     // yyyy-MM-dd (inclusiva)
  prezzo_notte: number;        // prezzo privato (pagante diretto)
  prezzo_booking?: number | null;
  prezzo_airbnb?: number | null;
  created_at: string;
}

export interface Impostazioni {
  ical_urls: Record<number, string>;
  nomi_camere: Record<number, string>;
  prezzi_camere: Record<number, number>;
  colori_camere: Record<number, string>;
  num_camere: number;
  ultimo_sync?: string;
  google_sheets_abilitato?: boolean;
  google_sheet_id?: string;
  nome_app?: string;
  logo_url?: string;
  checkin_email_days?: number;
}

export const CAMERE: Camera[] = [
  { id: 1, nome: 'Camera 1', prezzo_notte: 60 },
  { id: 2, nome: 'Camera 2', prezzo_notte: 60 },
  { id: 3, nome: 'Camera 3', prezzo_notte: 65 },
  { id: 4, nome: 'Camera 4', prezzo_notte: 65 },
  { id: 5, nome: 'Camera 5', prezzo_notte: 70 },
];

export const TIPI_ALLOGGIATO = {
  '16': 'Ospite Successivo',
  '17': 'Capo Famiglia',
  '18': 'Capo Gruppo',
  '19': 'Familiare',
  '20': 'Ospite Singolo',
} as const;
export type TipoAlloggiato = keyof typeof TIPI_ALLOGGIATO;

export interface Alloggiato {
  id: string;
  struttura_id?: string;
  prenotazione_id?: string;
  tipo: TipoAlloggiato;
  data_arrivo: string;
  permanenza: number;
  cognome: string;
  nome: string;
  sesso: 'M' | 'F';
  data_nascita: string;
  comune_nascita: string;
  provincia_nascita: string;
  stato_nascita: string;
  cittadinanza: string;
  tipo_documento: string;
  numero_documento: string;
  luogo_rilascio: string;
  /** Impostato quando la schedina è stata accettata da Alloggiati Web */
  inviato_portale_at?: string | null;
  created_at: string;
}

// Biancheria consegnata alla lavanderia per stanza pulita in un giorno (inserita dalla collaboratrice).
// Le voci ricalcano il buono di consegna della lavanderia.
export const CAPI_BIANCHERIA = [
  { key: 'lenz_sing',   label: 'Lenz. sing.' },
  { key: 'lenz_matr',   label: 'Lenz. matr.' },
  { key: 'federe',      label: 'Federe' },
  { key: 'telo_doccia', label: 'T. doccia' },
  { key: 'telo_viso',   label: 'T. viso' },
  { key: 'telo_ospite', label: 'T. ospite (bidè)' },
  { key: 'tappetini',   label: 'Tappetini' },
  { key: 'copriletto',  label: 'Copriletto' },
  { key: 'piumone',     label: 'Piumone' },
] as const;
export type CapoBiancheria = typeof CAPI_BIANCHERIA[number]['key'];

export type BiancheriaStanza = { data: string; camera_id: number; updated_at?: string } & Record<CapoBiancheria, number>;
