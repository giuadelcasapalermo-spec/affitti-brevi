// Codici ISTAT comuni italiani per AlloggiatiWeb
// Formato: 4 + regione(2) + provincia(3) + progressivo(3) = 9 cifre
// Es. Palermo = 4 + 19 + 082 + 053 = 419082053

export interface ComuneIT {
  nome: string;
  codice: string; // 9 cifre
  prov: string;
}

export const COMUNI: ComuneIT[] = [
  // === SICILIA (19) ===
  // PA (082)
  { nome: 'PALERMO',                  codice: '419082053', prov: 'PA' },
  { nome: 'BAGHERIA',                 codice: '419082005', prov: 'PA' },
  { nome: 'CARINI',                   codice: '419082020', prov: 'PA' },
  { nome: 'MONREALE',                 codice: '419082048', prov: 'PA' },
  { nome: 'PARTINICO',                codice: '419082055', prov: 'PA' },
  { nome: 'TERMINI IMERESE',          codice: '419082072', prov: 'PA' },
  { nome: 'CORLEONE',                 codice: '419082033', prov: 'PA' },
  { nome: 'CEFALÙ',                   codice: '419082027', prov: 'PA' },
  { nome: 'MISILMERI',                codice: '419082047', prov: 'PA' },
  { nome: 'VILLABATE',                codice: '419082080', prov: 'PA' },
  // CT (087)
  { nome: 'CATANIA',                  codice: '419087024', prov: 'CT' },
  { nome: 'ACIREALE',                 codice: '419087006', prov: 'CT' },
  { nome: 'ADRANO',                   codice: '419087007', prov: 'CT' },
  { nome: 'BELPASSO',                 codice: '419087008', prov: 'CT' },
  { nome: 'BIANCAVILLA',              codice: '419087009', prov: 'CT' },
  { nome: 'BRONTE',                   codice: '419087010', prov: 'CT' },
  { nome: 'CALTAGIRONE',              codice: '419087012', prov: 'CT' },
  { nome: 'MISTERBIANCO',             codice: '419087030', prov: 'CT' },
  { nome: 'PATERNÒ',                  codice: '419087034', prov: 'CT' },
  { nome: 'RANDAZZO',                 codice: '419087040', prov: 'CT' },
  // ME (083)
  { nome: 'MESSINA',                  codice: '419083048', prov: 'ME' },
  { nome: 'BARCELLONA POZZO DI GOTTO',codice: '419083007', prov: 'ME' },
  { nome: 'MILAZZO',                  codice: '419083049', prov: 'ME' },
  { nome: 'PATTI',                    codice: '419083065', prov: 'ME' },
  { nome: 'TAORMINA',                 codice: '419083085', prov: 'ME' },
  // AG (084)
  { nome: 'AGRIGENTO',                codice: '419084002', prov: 'AG' },
  { nome: 'CANICATTÌ',               codice: '419084011', prov: 'AG' },
  { nome: 'LICATA',                   codice: '419084024', prov: 'AG' },
  { nome: 'SCIACCA',                  codice: '419084035', prov: 'AG' },
  // CL (085)
  { nome: 'CALTANISSETTA',            codice: '419085007', prov: 'CL' },
  { nome: 'GELA',                     codice: '419085012', prov: 'CL' },
  { nome: 'NISCEMI',                  codice: '419085014', prov: 'CL' },
  // EN (086)
  { nome: 'ENNA',                     codice: '419086010', prov: 'EN' },
  { nome: 'NICOSIA',                  codice: '419086015', prov: 'EN' },
  { nome: 'PIAZZA ARMERINA',          codice: '419086018', prov: 'EN' },
  // RG (088)
  { nome: 'RAGUSA',                   codice: '419088065', prov: 'RG' },
  { nome: 'VITTORIA',                 codice: '419088093', prov: 'RG' },
  { nome: 'MODICA',                   codice: '419088055', prov: 'RG' },
  { nome: 'COMISO',                   codice: '419088023', prov: 'RG' },
  // SR (089)
  { nome: 'SIRACUSA',                 codice: '419089056', prov: 'SR' },
  { nome: 'AUGUSTA',                  codice: '419089003', prov: 'SR' },
  { nome: 'AVOLA',                    codice: '419089004', prov: 'SR' },
  { nome: 'FLORIDIA',                 codice: '419089013', prov: 'SR' },
  { nome: 'NOTO',                     codice: '419089036', prov: 'SR' },
  { nome: 'LENTINI',                  codice: '419089024', prov: 'SR' },
  // TP (081)
  { nome: 'TRAPANI',                  codice: '419081026', prov: 'TP' },
  { nome: 'MARSALA',                  codice: '419081011', prov: 'TP' },
  { nome: 'ALCAMO',                   codice: '419081001', prov: 'TP' },
  { nome: 'CASTELVETRANO',            codice: '419081004', prov: 'TP' },
  { nome: 'MAZARA DEL VALLO',         codice: '419081013', prov: 'TP' },
  { nome: 'CAMPOBELLO DI MAZARA',     codice: '419081003', prov: 'TP' },
  { nome: 'SALEMI',                   codice: '419081021', prov: 'TP' },

  // === PIEMONTE (01) ===  prefisso 401
  { nome: 'TORINO',                   codice: '401001272', prov: 'TO' },
  { nome: 'NOVARA',                   codice: '401003156', prov: 'NO' },
  { nome: 'ALESSANDRIA',              codice: '401006006', prov: 'AL' },
  { nome: 'ASTI',                     codice: '401005014', prov: 'AT' },
  { nome: 'CUNEO',                    codice: '401004059', prov: 'CN' },

  // === LOMBARDIA (03) ===
  { nome: 'MILANO',                   codice: '403015146', prov: 'MI' },
  { nome: 'BRESCIA',                  codice: '403017020', prov: 'BS' },
  { nome: 'BERGAMO',                  codice: '403016008', prov: 'BG' },
  { nome: 'MONZA',                    codice: '403108033', prov: 'MB' },
  { nome: 'COMO',                     codice: '403013057', prov: 'CO' },
  { nome: 'VARESE',                   codice: '403012133', prov: 'VA' },
  { nome: 'PAVIA',                    codice: '403018156', prov: 'PV' },
  { nome: 'MANTOVA',                  codice: '403020030', prov: 'MN' },
  { nome: 'CREMONA',                  codice: '403019036', prov: 'CR' },

  // === VENETO (05) ===
  { nome: 'VENEZIA',                  codice: '405027042', prov: 'VE' },
  { nome: 'VERONA',                   codice: '405023023', prov: 'VR' },
  { nome: 'PADOVA',                   codice: '405028060', prov: 'PD' },
  { nome: 'VICENZA',                  codice: '405024110', prov: 'VI' },
  { nome: 'TREVISO',                  codice: '405026085', prov: 'TV' },

  // === LIGURIA (07) ===
  { nome: 'GENOVA',                   codice: '407010025', prov: 'GE' },
  { nome: 'LA SPEZIA',                codice: '407011025', prov: 'SP' },
  { nome: 'SAVONA',                   codice: '407009059', prov: 'SV' },
  { nome: 'IMPERIA',                  codice: '407008031', prov: 'IM' },

  // === EMILIA-ROMAGNA (08) ===
  { nome: 'BOLOGNA',                  codice: '408037006', prov: 'BO' },
  { nome: 'MODENA',                   codice: '408036022', prov: 'MO' },
  { nome: 'PARMA',                    codice: '408034078', prov: 'PR' },
  { nome: 'REGGIO EMILIA',            codice: '408035033', prov: 'RE' },
  { nome: 'FERRARA',                  codice: '408038023', prov: 'FE' },
  { nome: 'RAVENNA',                  codice: '408039037', prov: 'RA' },
  { nome: 'FORLÌ',                    codice: '408040016', prov: 'FC' },
  { nome: 'RIMINI',                   codice: '408099006', prov: 'RN' },
  { nome: 'PIACENZA',                 codice: '408033063', prov: 'PC' },

  // === TOSCANA (09) ===
  { nome: 'FIRENZE',                  codice: '409048017', prov: 'FI' },
  { nome: 'PRATO',                    codice: '409100057', prov: 'PO' },
  { nome: 'LIVORNO',                  codice: '409049009', prov: 'LI' },
  { nome: 'PISA',                     codice: '409050048', prov: 'PI' },
  { nome: 'PONSACCO',                 codice: '409050028', prov: 'PI' },
  { nome: 'PONTEDERA',                codice: '409050029', prov: 'PI' },
  { nome: 'CASCINA',                  codice: '409050008', prov: 'PI' },
  { nome: 'SAN MINIATO',              codice: '409050035', prov: 'PI' },
  { nome: 'VOLTERRA',                 codice: '409050042', prov: 'PI' },
  { nome: 'AREZZO',                   codice: '409051007', prov: 'AR' },
  { nome: 'SIENA',                    codice: '409052111', prov: 'SI' },
  { nome: 'GROSSETO',                 codice: '409053009', prov: 'GR' },
  { nome: 'LUCCA',                    codice: '409046006', prov: 'LU' },
  { nome: 'PISTOIA',                  codice: '409047012', prov: 'PT' },

  // === LAZIO (12) ===
  { nome: 'ROMA',                     codice: '412058091', prov: 'RM' },
  { nome: 'LATINA',                   codice: '412059011', prov: 'LT' },
  { nome: 'FROSINONE',                codice: '412060016', prov: 'FR' },
  { nome: 'VITERBO',                  codice: '412056067', prov: 'VT' },
  { nome: 'RIETI',                    codice: '412057054', prov: 'RI' },

  // === CAMPANIA (15) ===
  { nome: 'NAPOLI',                   codice: '415063049', prov: 'NA' },
  { nome: 'SALERNO',                  codice: '415065073', prov: 'SA' },
  { nome: 'CASERTA',                  codice: '415061037', prov: 'CE' },
  { nome: 'AVELLINO',                 codice: '415064007', prov: 'AV' },
  { nome: 'NUSCO',                    codice: '415064066', prov: 'AV' },
  { nome: 'BENEVENTO',                codice: '415062009', prov: 'BN' },

  // === PUGLIA (16) ===
  { nome: 'BARI',                     codice: '416072006', prov: 'BA' },
  { nome: 'TARANTO',                  codice: '416073061', prov: 'TA' },
  { nome: 'FOGGIA',                   codice: '416071023', prov: 'FG' },
  { nome: 'LECCE',                    codice: '416075028', prov: 'LE' },
  { nome: 'BRINDISI',                 codice: '416074010', prov: 'BR' },
  { nome: 'ANDRIA',                   codice: '416072005', prov: 'BA' },
  { nome: 'BARLETTA',                 codice: '416110010', prov: 'BT' },

  // === CALABRIA (18) ===
  { nome: 'REGGIO CALABRIA',          codice: '418080063', prov: 'RC' },
  { nome: 'CATANZARO',                codice: '418079022', prov: 'CZ' },
  { nome: 'COSENZA',                  codice: '418078031', prov: 'CS' },

  // === SARDEGNA (20) ===
  { nome: 'CAGLIARI',                 codice: '420092009', prov: 'CA' },
  { nome: 'SASSARI',                  codice: '420090061', prov: 'SS' },
  { nome: 'NUORO',                    codice: '420091048', prov: 'NU' },

  // === ALTRI ===
  { nome: 'TRIESTE',                  codice: '406032006', prov: 'TS' },
  { nome: 'TRENTO',                   codice: '404022221', prov: 'TN' },
  { nome: 'BOLZANO',                  codice: '404021013', prov: 'BZ' },
  { nome: 'PERUGIA',                  codice: '410054039', prov: 'PG' },
  { nome: 'ANCONA',                   codice: '411042002', prov: 'AN' },
  { nome: 'PESCARA',                  codice: '413068063', prov: 'PE' },
  { nome: "L'AQUILA",                 codice: '413066001', prov: 'AQ' },
  { nome: 'POTENZA',                  codice: '417076067', prov: 'PZ' },
  { nome: 'CAMPOBASSO',               codice: '414070006', prov: 'CB' },
  { nome: 'AOSTA',                    codice: '402007003', prov: 'AO' },
];

export function cercaComuni(query: string): ComuneIT[] {
  if (!query || query.length < 2) return [];
  const q = query.trim().toUpperCase();
  return COMUNI.filter(c =>
    c.nome.toUpperCase().includes(q) || c.codice.startsWith(q) || c.prov.toUpperCase() === q
  ).slice(0, 10);
}

export function nomeACodiceComune(nome: string): string {
  const upper = nome.trim().toUpperCase();
  return COMUNI.find(c => c.nome.toUpperCase() === upper)?.codice ?? '';
}
