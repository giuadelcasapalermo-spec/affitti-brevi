// Codici paese per AlloggiatiWeb - fonte ufficiale Polizia di Stato
// https://alloggiatiweb.poliziadistato.it/portalealloggiati/ashx/Download.ashx?ID=1&N=STATI
// stato_nascita: blank per italiani nati in Italia; codice 9-cifre per nati all'estero
// cittadinanza: 100000100 per italiani; codice 9-cifre per stranieri

export interface PaeseAlloggiati {
  nome: string;
  codice: string;
}

export const CODICE_ITALIA = '100000100';

export const PAESI: PaeseAlloggiati[] = [
  { nome: 'ITALIA', codice: '100000100' },
  { nome: 'AFGHANISTAN', codice: '100000301' },
  { nome: 'ALBANIA', codice: '100000201' },
  { nome: 'ALGERIA', codice: '100000401' },
  { nome: 'ANDORRA', codice: '100000202' },
  { nome: 'ANGOLA', codice: '100000402' },
  { nome: 'ANGUILLA (ISOLA)', codice: '100000733' },
  { nome: 'ANTIGUA E BARBUDA', codice: '100000503' },
  { nome: 'APOLIDE', codice: '100000999' },
  { nome: 'ARABIA SAUDITA', codice: '100000302' },
  { nome: 'ARGENTINA', codice: '100000602' },
  { nome: 'ARMENIA', codice: '100000358' },
  { nome: 'AUSTRALIA', codice: '100000701' },
  { nome: 'AUSTRIA', codice: '100000203' },
  { nome: 'AZERBAIGIAN', codice: '100000359' },
  { nome: 'BAHAMAS', codice: '100000505' },
  { nome: 'BAHREIN', codice: '100000304' },
  { nome: 'BANGLADESH', codice: '100000305' },
  { nome: 'BARBADOS', codice: '100000506' },
  { nome: 'BELGIO', codice: '100000206' },
  { nome: 'BELIZE', codice: '100000507' },
  { nome: 'BENIN', codice: '100000406' },
  { nome: 'BERMUDE', codice: '100000739' },
  { nome: 'BHUTAN', codice: '100000306' },
  { nome: 'BIELORUSSIA', codice: '100000256' },
  { nome: 'BOLIVIA', codice: '100000604' },
  { nome: 'BOPHUTHATSWANA', codice: '100000740' },
  { nome: 'BOSNIA ED ERZEGOVINA', codice: '100000252' },
  { nome: 'BOTSWANA', codice: '100000408' },
  { nome: 'BRASILE', codice: '100000605' },
  { nome: 'BRUNEI DARUSSALAM', codice: '100000309' },
  { nome: 'BULGARIA', codice: '100000209' },
  { nome: 'BURKINA FASO', codice: '100000409' },
  { nome: 'BURUNDI', codice: '100000410' },
  { nome: 'CAMBOGIA', codice: '100000310' },
  { nome: 'CAMERUN', codice: '100000411' },
  { nome: 'CANADA', codice: '100000509' },
  { nome: 'CAPO VERDE', codice: '100000413' },
  { nome: 'CAYMAN (ISOLE)', codice: '100000742' },
  { nome: 'CECOSLOVACCHIA', codice: '100000210' },
  { nome: 'CHRISTMAS', codice: '100000743' },
  { nome: 'CIAD', codice: '100000415' },
  { nome: 'CILE', codice: '100000606' },
  { nome: 'CINA', codice: '100000314' },
  { nome: 'CIPRO', codice: '100000315' },
  { nome: 'COCOS', codice: '100000746' },
  { nome: 'COLOMBIA', codice: '100000608' },
  { nome: 'COMORE', codice: '100000417' },
  { nome: 'CONGO', codice: '100000418' },
  { nome: 'COREA DEL NORD', codice: '100000319' },
  { nome: 'COREA DEL SUD', codice: '100000320' },
  { nome: "COSTA D'AVORIO", codice: '100000404' },
  { nome: 'COSTA RICA', codice: '100000513' },
  { nome: 'CROAZIA', codice: '100000250' },
  { nome: 'CUBA', codice: '100000514' },
  { nome: 'DANIMARCA', codice: '100000212' },
  { nome: 'DOMINICA', codice: '100000515' },
  { nome: 'ECUADOR', codice: '100000609' },
  { nome: 'EGITTO', codice: '100000419' },
  { nome: 'EL SALVADOR', codice: '100000517' },
  { nome: 'EMIRATI ARABI UNITI', codice: '100000322' },
  { nome: 'ERITREA', codice: '100000466' },
  { nome: 'ESTONIA', codice: '100000247' },
  { nome: 'ETIOPIA', codice: '100000420' },
  { nome: 'FAER OER', codice: '100000755' },
  { nome: 'FEDERAZIONE RUSSA', codice: '100000245' },
  { nome: 'FIGI', codice: '100000703' },
  { nome: 'FILIPPINE', codice: '100000323' },
  { nome: 'FINLANDIA', codice: '100000214' },
  { nome: 'FRANCIA', codice: '100000215' },
  { nome: 'GABON', codice: '100000421' },
  { nome: 'GAMBIA', codice: '100000422' },
  { nome: 'GEORGIA', codice: '100000360' },
  { nome: 'GEORGIA SUD E ISOLE SANDWICH AUSTRALI', codice: '110000022' },
  { nome: 'GERMANIA', codice: '100000216' },
  { nome: 'GHANA', codice: '100000423' },
  { nome: 'GIAMAICA', codice: '100000518' },
  { nome: 'GIAPPONE', codice: '100000326' },
  { nome: 'GIBUTI', codice: '100000424' },
  { nome: 'GIORDANIA', codice: '100000327' },
  { nome: 'GRECIA', codice: '100000220' },
  { nome: 'GRENADA', codice: '100000519' },
  { nome: 'GROENLANDIA', codice: '100000758' },
  { nome: 'GUADALUPA', codice: '100000759' },
  { nome: 'GUAM', codice: '100000760' },
  { nome: 'GUATEMALA', codice: '100000523' },
  { nome: 'GUAYANA FRANCESE', codice: '100000761' },
  { nome: 'GUERNSEY', codice: '110000014' },
  { nome: 'GUINEA', codice: '100000425' },
  { nome: 'GUINEA BISSAU', codice: '100000426' },
  { nome: 'GUINEA EQUATORIALE', codice: '100000427' },
  { nome: 'GUYANA', codice: '100000612' },
  { nome: 'HAITI', codice: '100000524' },
  { nome: 'HONDURAS', codice: '100000525' },
  { nome: 'HONG KONG', codice: '110000005' },
  { nome: 'INDIA', codice: '100000330' },
  { nome: 'INDONESIA', codice: '100000331' },
  { nome: 'IRAN', codice: '100000332' },
  { nome: 'IRAQ', codice: '100000333' },
  { nome: 'IRLANDA', codice: '100000221' },
  { nome: 'ISLANDA', codice: '100000223' },
  { nome: 'ISOLE VERGINI', codice: '100000764' },
  { nome: 'ISRAELE', codice: '100000334' },
  { nome: 'KAZAKISTAN', codice: '100000356' },
  { nome: 'KENYA', codice: '100000428' },
  { nome: 'KIRGHIZISTAN', codice: '100000361' },
  { nome: 'KIRIBATI', codice: '100000708' },
  { nome: 'KOSOVO', codice: '100001002' },
  { nome: 'KUWAIT', codice: '100000335' },
  { nome: 'LA REUNION', codice: '100000765' },
  { nome: 'LAOS', codice: '100000336' },
  { nome: 'LESOTHO', codice: '100000429' },
  { nome: 'LETTONIA', codice: '100000248' },
  { nome: 'LIBANO', codice: '100000337' },
  { nome: 'LIBERIA', codice: '100000430' },
  { nome: 'LIBIA', codice: '100000431' },
  { nome: 'LIECHTENSTEIN', codice: '100000225' },
  { nome: 'LITUANIA', codice: '100000249' },
  { nome: 'LUSSEMBURGO', codice: '100000226' },
  { nome: 'MACAO', codice: '110000003' },
  { nome: 'MACEDONIA', codice: '100000253' },
  { nome: 'MACEDONIA DEL NORD', codice: '100000997' },
  { nome: 'MADAGASCAR', codice: '100000432' },
  { nome: 'MALAWI', codice: '100000434' },
  { nome: 'MALAYSIA', codice: '100000767' },
  { nome: 'MALDIVE', codice: '100000339' },
  { nome: 'MALI', codice: '100000435' },
  { nome: 'MALTA', codice: '100000227' },
  { nome: 'MALVINE', codice: '100000768' },
  { nome: 'MAN', codice: '100000769' },
  { nome: 'MAROCCO', codice: '100000436' },
  { nome: 'MARSHALL', codice: '100000772' },
  { nome: 'MARTINICA', codice: '100000773' },
  { nome: 'MAURITANIA', codice: '100000437' },
  { nome: 'MAURIZIO', codice: '100000438' },
  { nome: 'MAYOTTE', codice: '100000774' },
  { nome: 'MESSICO', codice: '100000527' },
  { nome: 'MICRONESIA STATI FEDERALI', codice: '100000775' },
  { nome: 'MOLDAVIA', codice: '100000254' },
  { nome: 'MONACO', codice: '100000229' },
  { nome: 'MONGOLIA', codice: '100000341' },
  { nome: 'MONTENEGRO', codice: '100001001' },
  { nome: 'MONTSERRAT', codice: '100000777' },
  { nome: 'MOZAMBICO', codice: '100000440' },
  { nome: 'MYANMAR-BIRMANIA', codice: '100000307' },
  { nome: 'NAMIBIA', codice: '100000441' },
  { nome: 'NAURU', codice: '100000715' },
  { nome: 'NEPAL', codice: '100000342' },
  { nome: 'NICARAGUA', codice: '100000529' },
  { nome: 'NIGER', codice: '100000442' },
  { nome: 'NIGERIA', codice: '100000443' },
  { nome: 'NORFOLK', codice: '100000778' },
  { nome: 'NORVEGIA', codice: '100000231' },
  { nome: 'NUOVA CALEDONIA', codice: '100000780' },
  { nome: 'NUOVA ZELANDA', codice: '100000719' },
  { nome: 'OMAN', codice: '100000343' },
  { nome: 'PAESI BASSI', codice: '100000232' },
  { nome: 'PAKISTAN', codice: '100000344' },
  { nome: 'PALAU REPUBBLICA', codice: '100000783' },
  { nome: 'PALESTINA', codice: '110000001' },
  { nome: 'PANAMA', codice: '100000530' },
  { nome: 'PAPUASIA-N.GUINEA', codice: '100000721' },
  { nome: 'PARAGUAY', codice: '100000614' },
  { nome: "PERU'", codice: '100000615' },
  { nome: 'PITCAIRN', codice: '100000786' },
  { nome: 'POLINESIA', codice: '100000787' },
  { nome: 'POLONIA', codice: '100000233' },
  { nome: 'PORTOGALLO', codice: '100000234' },
  { nome: 'PUERTO RICO', codice: '100000790' },
  { nome: 'QATAR', codice: '100000345' },
  { nome: 'REGNO UNITO', codice: '100000219' },
  { nome: 'REPUBBLICA CECA', codice: '100000257' },
  { nome: 'REPUBBLICA CENTRAFRICANA', codice: '100000414' },
  { nome: 'REPUBBLICA DEMOCRATICA DEL CONGO', codice: '100000998' },
  { nome: 'REPUBBLICA DOMINICANA', codice: '100000516' },
  { nome: 'REPUBBLICA SLOVACCA', codice: '100000255' },
  { nome: 'ROMANIA', codice: '100000235' },
  { nome: 'RUANDA', codice: '100000446' },
  { nome: 'S. CHRISTOPHER E NEVIS', codice: '100000534' },
  { nome: 'S. VINCENT E GRENADINE', codice: '100000533' },
  { nome: 'SAHARA SPAGNOLO', codice: '100000795' },
  { nome: 'SAINT LUCIA', codice: '100000532' },
  { nome: 'SAINT PIERRE ET MIQUELON', codice: '100000796' },
  { nome: 'SAINT VINCENT E GRENADINE', codice: '100000797' },
  { nome: 'SALOMONE', codice: '100000725' },
  { nome: 'SAMOA', codice: '100000727' },
  { nome: 'SAMOA AMERICANE', codice: '100000798' },
  { nome: 'SAN MARINO', codice: '100000236' },
  { nome: 'SANT ELENA', codice: '100000799' },
  { nome: "SAO TOME' E PRINCIPE", codice: '100000448' },
  { nome: 'SENEGAL', codice: '100000450' },
  { nome: 'SERBIA', codice: '100001000' },
  { nome: 'SEYCHELLES', codice: '100000449' },
  { nome: 'SIERRA LEONE', codice: '100000451' },
  { nome: 'SINGAPORE', codice: '100000346' },
  { nome: 'SIRIA', codice: '100000348' },
  { nome: 'SLOVENIA', codice: '100000251' },
  { nome: 'SOMALIA', codice: '100000453' },
  { nome: 'SPAGNA', codice: '100000239' },
  { nome: 'SRI LANKA (CEYLON)', codice: '100000311' },
  { nome: "STATI UNITI D'AMERICA", codice: '100000536' },
  { nome: "STATO DELLA CITTA' DEL VATICANO", codice: '100000246' },
  { nome: 'SUD SUDAN', codice: '100000467' },
  { nome: 'SUDAFRICA', codice: '100000454' },
  { nome: 'SUDAN', codice: '100000455' },
  { nome: 'SURINAME', codice: '100000616' },
  { nome: 'SVEZIA', codice: '100000240' },
  { nome: 'SVIZZERA', codice: '100000241' },
  { nome: 'SWAZILAND', codice: '100000456' },
  { nome: 'TAGIKISTAN', codice: '100000362' },
  { nome: 'TAIWAN', codice: '100000363' },
  { nome: 'TANZANIA', codice: '100000457' },
  { nome: 'THAILANDIA', codice: '100000349' },
  { nome: 'TIMOR', codice: '100000805' },
  { nome: 'TOGO', codice: '100000458' },
  { nome: 'TOKELAU', codice: '100000806' },
  { nome: 'TONGA', codice: '100000730' },
  { nome: 'TRINIDAD E TOBAGO', codice: '100000617' },
  { nome: 'TUNISIA', codice: '100000460' },
  { nome: 'TURCHIA', codice: '100000351' },
  { nome: 'TURKMENISTAN', codice: '100000364' },
  { nome: 'TURKS', codice: '100000810' },
  { nome: 'TUVALU', codice: '100000731' },
  { nome: 'UCRAINA', codice: '100000243' },
  { nome: 'UGANDA', codice: '100000461' },
  { nome: 'UNGHERIA', codice: '100000244' },
  { nome: 'URUGUAY', codice: '100000618' },
  { nome: 'UZBEKISTAN', codice: '100000357' },
  { nome: 'VANUATU', codice: '100000732' },
  { nome: 'VENEZUELA', codice: '100000619' },
  { nome: 'VERGINI BRITANNICHE (ISOLE)', codice: '100000812' },
  { nome: 'VIETNAM', codice: '100000353' },
  { nome: 'WALLIS', codice: '100000815' },
  { nome: 'YEMEN', codice: '100000354' },
  { nome: 'ZAMBIA', codice: '100000464' },
  { nome: 'ZIMBABWE', codice: '100000465' },
  // alias per compatibilita'
  { nome: 'PERU', codice: '100000615' },
  { nome: 'SRI LANKA', codice: '100000311' },
  { nome: 'STATI UNITI', codice: '100000536' },
  { nome: 'VATICANO', codice: '100000246' },
];

// Mapping vecchi codici Z (legacy ISTAT) → nuovi codici 9-cifre per retrocompatibilità DB
const Z_LEGACY: Record<string, string> = {
  'Z100': '100000201', 'Z101': '100000202', 'Z102': '100000203', 'Z103': '100000206',
  'Z104': '100000209', 'Z105': '100000315', 'Z106': '100000246', 'Z107': '100000212',
  'Z108': '100000214', 'Z110': '100000215', 'Z112': '100000216', 'Z113': '100000220',
  'Z114': '100000219', 'Z116': '100000221', 'Z117': '100000223', 'Z119': '100000225',
  'Z120': '100000226', 'Z121': '100000227', 'Z122': '100000229', 'Z125': '100000231',
  'Z126': '100000232', 'Z127': '100000233', 'Z128': '100000234', 'Z129': '100000235',
  'Z130': '100000236', 'Z131': '100000239', 'Z132': '100000240', 'Z133': '100000241',
  'Z134': '100000244', 'Z135': '100000351', 'Z136': '100000243', 'Z137': '100000256',
  'Z138': '100000245', 'Z140': '100000254', 'Z142': '100000247', 'Z145': '100000248',
  'Z146': '100000249', 'Z149': '100000250', 'Z150': '100000251', 'Z153': '100000252',
  'Z154': '100000997', 'Z155': '100000255', 'Z158': '100001000', 'Z159': '100001001',
  'Z160': '100001002',
  'Z201': '100000301', 'Z203': '100000302', 'Z209': '100000311', 'Z210': '100000314',
  'Z213': '100000320', 'Z216': '100000323', 'Z219': '100000326', 'Z222': '100000330',
  'Z223': '100000331', 'Z224': '100000332', 'Z225': '100000333', 'Z226': '100000334',
  'Z236': '100000344', 'Z245': '100000348', 'Z246': '100000349', 'Z249': '100000305',
  'Z251': '100000353',
  'Z301': '100000401', 'Z315': '100000420', 'Z322': '100000423', 'Z325': '100000428',
  'Z326': '100000431', 'Z330': '100000436', 'Z335': '100000443', 'Z336': '100000419',
  'Z343': '100000450', 'Z346': '100000453', 'Z347': '100000454', 'Z352': '100000460',
  'Z401': '100000509', 'Z404': '100000536',
  'Z600': '100000602', 'Z601': '100000604', 'Z602': '100000605', 'Z603': '100000606',
  'Z604': '100000608', 'Z605': '100000514', 'Z606': '100000609', 'Z608': '100000527',
  'Z609': '100000615', 'Z614': '100000619',
  'Z700': '100000701', 'Z703': '100000719',
};

const nomeMap = new Map(PAESI.map(p => [p.nome, p.codice]));

// Mappa inversa: codice 9-cifre → Z-code belfiore (per stato_nascita nel file AlloggiatiWeb)
// stato_nascita usa i codici belfiore (Z600, Z132...) padded a 9 char, NON i codici 9-cifre
const CODICE9_TO_ZCODE = new Map<string, string>(
  Object.entries(Z_LEGACY).map(([z, code]) => [code, z])
);

// Restituisce il codice da usare nel campo stato_nascita (belfiore padded 9 o fallback 9-cifre)
export function codiceStatoNascita(code9: string): string {
  if (!code9) return '';
  const z = CODICE9_TO_ZCODE.get(code9);
  return z ?? code9; // Z-code se disponibile, altrimenti 9-cifre come fallback
}

export function normalizzaNome(raw: string): string {
  return raw.trim().toUpperCase()
    // alias italiani
    .replace(/\bGRAN\s+BRETAGNA\b/, 'REGNO UNITO')
    .replace(/\bOLAND[AE]\b/, 'PAESI BASSI')
    .replace(/\bUCRAIN[AE]\b/, 'UCRAINA')
    .replace(/\bRUSSIA\b/, 'FEDERAZIONE RUSSA')
    .replace(/\bSTATI\s+UNITI\s+D['']AMERICA\b/, "STATI UNITI D'AMERICA")
    .replace(/\bU\.?S\.?A\.?\b/, 'STATI UNITI')
    .replace(/\bSLOVACCHIA\b/, 'REPUBBLICA SLOVACCA')
    .replace(/\bCECIA\b/, 'REPUBBLICA CECA')
    .replace(/\bBIRMANIA\b/, 'MYANMAR-BIRMANIA')
    .replace(/\bSUD\s+AFRICA\b/, 'SUDAFRICA')
    // nomi inglesi → italiano
    .replace(/\bGERMANY\b/, 'GERMANIA')
    .replace(/\bFRANCE\b/, 'FRANCIA')
    .replace(/\bSPAIN\b/, 'SPAGNA')
    .replace(/\bITALY\b/, 'ITALIA')
    .replace(/\bSWITZERLAND\b/, 'SVIZZERA')
    .replace(/\bNETHERLANDS\b/, 'PAESI BASSI')
    .replace(/\bHOLLAND\b/, 'PAESI BASSI')
    .replace(/\bPOLAND\b/, 'POLONIA')
    .replace(/\bUKRAINE\b/, 'UCRAINA')
    .replace(/\bUNITED\s+KINGDOM\b/, 'REGNO UNITO')
    .replace(/\bUNITED\s+STATES(\s+OF\s+AMERICA)?\b/, 'STATI UNITI')
    .replace(/\bCHINA\b/, 'CINA')
    .replace(/\bJAPAN\b/, 'GIAPPONE')
    .replace(/\bBRAZIL\b/, 'BRASILE')
    .replace(/\bTURKEY\b/, 'TURCHIA')
    .replace(/\bNORTH\s+MACEDONIA\b/, 'MACEDONIA DEL NORD')
    .replace(/\bMOROCCO\b/, 'MAROCCO')
    .replace(/\bEGYPT\b/, 'EGITTO')
    .replace(/\bBELGIUM\b/, 'BELGIO')
    .replace(/\bSWEDEN\b/, 'SVEZIA')
    .replace(/\bPORTUGAL\b/, 'PORTOGALLO')
    .replace(/\bHUNGARY\b/, 'UNGHERIA')
    .replace(/\bCZECH\s+REPUBLIC\b/, 'REPUBBLICA CECA')
    .replace(/\bSLOVAKIA\b/, 'REPUBBLICA SLOVACCA')
    .replace(/\bALBANIA\b/, 'ALBANIA')
    .replace(/\bMEXICO\b/, 'MESSICO')
    .replace(/\bCHILE\b/, 'CILE')
    .replace(/\bPHILIPPINES\b/, 'FILIPPINE')
    .replace(/\bINDIA\b/, 'INDIA')
    .replace(/\bPAKISTAN\b/, 'PAKISTAN')
    .replace(/\bAUSTRIA\b/, 'AUSTRIA')
    .replace(/\bAUSTRALIA\b/, 'AUSTRALIA')
    .replace(/\bCOLOMBIA\b/, 'COLOMBIA')
    .replace(/\bVENEZUELA\b/, 'VENEZUELA')
    .replace(/\bECUADOR\b/, 'ECUADOR')
    .replace(/\bCUBA\b/, 'CUBA')
    .replace(/\bPERU\b/, 'PERU')
    .replace(/\bROMANIA\b/, 'ROMANIA')
    .replace(/\bGREECE\b/, 'GRECIA')
    .replace(/\bDENMARK\b/, 'DANIMARCA')
    .replace(/\bFINLAND\b/, 'FINLANDIA')
    .replace(/\bNORWAY\b/, 'NORVEGIA')
    .replace(/\bIRELAND\b/, 'IRLANDA')
    .replace(/\bCROATIA\b/, 'CROAZIA')
    .replace(/\bSERBIA\b/, 'SERBIA')
    .replace(/\bBULGARIA\b/, 'BULGARIA')
    .replace(/\bSLOVENIA\b/, 'SLOVENIA')
    .replace(/\bLITHUANIA\b/, 'LITUANIA')
    .replace(/\bLATVIA\b/, 'LETTONIA')
    .replace(/\bESTONIA\b/, 'ESTONIA')
    .replace(/\bTUNISIA\b/, 'TUNISIA')
    .replace(/\bKOREA\b/, 'COREA DEL SUD');
}

export function nomePaeseACodice(nome: string): string {
  if (!nome) return '';
  const upper = nome.trim().toUpperCase();
  // Z-code legacy → nuovo codice
  if (/^Z\d{3}$/i.test(upper)) return Z_LEGACY[upper.toUpperCase()] ?? '';
  return nomeMap.get(normalizzaNome(upper)) ?? '';
}

export function nomePaeseACodiciCittadinanza(nome: string): string {
  return nomePaeseACodice(nome);
}

const AGGETTIVI_CITTADINANZA: Record<string, string> = {
  'ITALIANA':     CODICE_ITALIA,
  'TEDESCA':      '100000216',
  'FRANCESE':     '100000215',
  'SPAGNOLA':     '100000239',
  'POLACCA':      '100000233',
  'ROMENA':       '100000235',
  'RUMENA':       '100000235',
  'ALBANESE':     '100000201',
  'UCRAINA':      '100000243',
  'RUSSA':        '100000245',
  'CINESE':       '100000314',
  'AMERICANA':    '100000536',
  'BRASILIANA':   '100000605',
  'BRASILIANO':   '100000605',
  'ARGENTINA':    '100000602',
  'ARGENTINO':    '100000602',
  'INGLESE':      '100000219',
  'BRITANNICA':   '100000219',
  'BRITANNICO':   '100000219',
  'SVIZZERA':     '100000241',
  'SVIZZERO':     '100000241',
  'AUSTRIACA':    '100000203',
  'AUSTRIACO':    '100000203',
  'BELGA':        '100000206',
  'OLANDESE':     '100000232',
  'GRECA':        '100000220',
  'GRECO':        '100000220',
  'TURCA':        '100000351',
  'TURCO':        '100000351',
  'MAROCCHINA':   '100000436',
  'MAROCCHINO':   '100000436',
  'TUNISINA':     '100000460',
  'TUNISINO':     '100000460',
  'EGIZIANA':     '100000419',
  'EGIZIANO':     '100000419',
  'INDIANA':      '100000330',
  'INDIANO':      '100000330',
  'PAKISTANA':    '100000344',
  'PAKISTANO':    '100000344',
  'FILIPINA':     '100000323',
  'FILIPPINO':    '100000323',
  'GIAPPONESE':   '100000326',
  'AUSTRALIANA':  '100000701',
  'AUSTRALIANO':  '100000701',
  'SVEDESE':      '100000240',
  'PORTOGHESE':   '100000234',
  'UNGHERESE':    '100000244',
  'RUMENO':       '100000235',
  'COLOMBIANA':   '100000608',
  'COLOMBIANO':   '100000608',
  'VENEZUELANA':  '100000619',
  'VENEZUELANO':  '100000619',
  'MESSICANA':    '100000527',
  'MESSICANO':    '100000527',
  'CILENA':       '100000606',
  'CILENO':       '100000606',
  'PERUVIANA':    '100000615',
  'PERUVIANO':    '100000615',
  'ECUADORIANA':  '100000609',
  'ECUADORIANO':  '100000609',
  'CUBANA':       '100000514',
  'CUBANO':       '100000514',
  'MACEDONE':     '100000997',
  // aggettivi / nomi inglesi
  'GERMAN':       '100000216',
  'FRENCH':       '100000215',
  'SPANISH':      '100000239',
  'ITALIAN':      CODICE_ITALIA,
  'SWISS':        '100000241',
  'DUTCH':        '100000232',
  'POLISH':       '100000233',
  'ROMANIAN':     '100000235',
  'ALBANIAN':     '100000201',
  'UKRAINIAN':    '100000243',
  'RUSSIAN':      '100000245',
  'CHINESE':      '100000314',
  'AMERICAN':     '100000536',
  'BRAZILIAN':    '100000605',
  'ARGENTINIAN':  '100000602',
  'ARGENTINE':    '100000602',
  'BRITISH':      '100000219',
  'ENGLISH':      '100000219',
  'AUSTRIAN':     '100000203',
  'BELGIAN':      '100000206',
  'GREEK':        '100000220',
  'TURKISH':      '100000351',
  'MOROCCAN':     '100000436',
  'TUNISIAN':     '100000460',
  'EGYPTIAN':     '100000419',
  'INDIAN':       '100000330',
  'PAKISTANI':    '100000344',
  'FILIPINO':     '100000323',
  'PHILIPPINE':   '100000323',
  'JAPANESE':     '100000326',
  'AUSTRALIAN':   '100000701',
  'SWEDISH':      '100000240',
  'PORTUGUESE':   '100000234',
  'HUNGARIAN':    '100000244',
  'COLOMBIAN':    '100000608',
  'VENEZUELAN':   '100000619',
  'MEXICAN':      '100000527',
  'CHILEAN':      '100000606',
  'PERUVIAN':     '100000615',
  'ECUADORIAN':   '100000609',
  'CUBAN':        '100000514',
  'MACEDONIAN':   '100000997',
};

export function aggettivoCittadinanzaACodice(aggettivo: string): string {
  if (!aggettivo) return '';
  const upper = aggettivo.trim().toUpperCase();
  return AGGETTIVI_CITTADINANZA[upper] ?? nomePaeseACodiciCittadinanza(upper);
}
