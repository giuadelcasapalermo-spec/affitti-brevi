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
  created_at: string;
}

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
  stato: 'confermata' | 'pending' | 'cancellata';
  note: string;
  created_at: string;
  fonte: 'manuale' | 'ical' | 'sheet';
  ical_uid?: string;
}

export const CATEGORIE_USCITA = [
  'Pulizie',
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
  '16': 'Ospite Singolo',
  '17': 'Capo Famiglia',
  '18': 'Capo Gruppo',
  '19': 'Familiare',
  '20': 'Membro Gruppo',
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
  created_at: string;
}
