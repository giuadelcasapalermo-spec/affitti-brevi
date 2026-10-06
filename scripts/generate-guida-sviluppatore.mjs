import { Document, Packer } from 'docx';
import fs from 'fs';
import {
  h1, h2, p, bullet, code, spacer, note, tip, warn, pageBreak, makeTable, stepBox,
  figure, svgToPng, cover, versione, footer, docStyles, pageMargins, SVG_FONT, SVG_ARROW,
} from './docx-style.mjs';

// Uso: node scripts/generate-guida-sviluppatore.mjs  →  GUIDA_SVILUPPATORE_NUOVA_ISTANZA.docx

// ─── Diagrammi ──────────────────────────────────────────────────────────────
function svgArchitettura() {
  const proj = (x, slug) => `
    <rect x="${x}" y="200" width="250" height="70" rx="10" fill="#2563EB"/>
    <text x="${x + 125}" y="230" text-anchor="middle" font-size="17" font-weight="700" fill="#fff">Progetto Vercel</text>
    <text x="${x + 125}" y="253" text-anchor="middle" font-size="14" fill="#DBEAFE">ab-${slug} · env proprie</text>
    <line x1="${x + 125}" y1="270" x2="${x + 125}" y2="318" stroke="#1E3A5F" stroke-width="2.5" marker-end="url(#a)"/>
    <rect x="${x}" y="324" width="250" height="70" rx="10" fill="#1E3A5F"/>
    <text x="${x + 125}" y="354" text-anchor="middle" font-size="17" font-weight="700" fill="#fff">Database Neon</text>
    <text x="${x + 125}" y="377" text-anchor="middle" font-size="14" fill="#CBD5E1">DATABASE_URL dedicata</text>
    <line x1="550" y1="130" x2="${x + 125}" y2="194" stroke="#1E3A5F" stroke-width="2.5" marker-end="url(#a)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="450" ${SVG_FONT}>
    ${SVG_ARROW}
    <rect width="1100" height="450" fill="#fff"/>
    <text x="550" y="36" text-anchor="middle" font-size="22" font-weight="700" fill="#1E3A5F">Un repository, un progetto Vercel e un database per ogni ragione sociale</text>
    <rect x="400" y="60" width="300" height="70" rx="10" fill="#F1F5F9" stroke="#1E3A5F" stroke-width="2"/>
    <text x="550" y="90" text-anchor="middle" font-size="17" font-weight="700" fill="#1E3A5F">Repository GitHub · branch main</text>
    <text x="550" y="113" text-anchor="middle" font-size="14" fill="#374151">un push = deploy di tutte le istanze</text>
    ${proj(70, 'cliente-a')}
    ${proj(425, 'cliente-b')}
    ${proj(780, 'cliente-c')}
    <text x="550" y="430" text-anchor="middle" font-size="15" fill="#6B7280">AUTH_SECRET, CRON_SECRET e DATABASE_URL diversi per ogni istanza · regione fra1 (Francoforte)</text>
  </svg>`;
}

function svgProcedura() {
  const steps = [
    ['Progetto', 'Vercel'], ['Database', 'Neon'], ['Variabili', 'd\'ambiente'],
    ['Deploy', 'produzione'], ['Init DB', 'e admin'], ['Configura', 'e verifica'],
  ];
  const w = 160, gap = 22, x0 = 20;
  const boxes = steps.map(([a, b], i) => {
    const x = x0 + i * (w + gap);
    const arrow = i < steps.length - 1
      ? `<line x1="${x + w + 2}" y1="115" x2="${x + w + gap - 3}" y2="115" stroke="#1E3A5F" stroke-width="2.5" marker-end="url(#a)"/>` : '';
    return `<rect x="${x}" y="70" width="${w}" height="90" rx="12" fill="${i === 4 ? '#1E3A5F' : '#2563EB'}"/>
      <text x="${x + w / 2}" y="110" text-anchor="middle" font-size="18" font-weight="700" fill="#fff">${a}</text>
      <text x="${x + w / 2}" y="136" text-anchor="middle" font-size="15" fill="#DBEAFE">${b}</text>
      <circle cx="${x + 18}" cy="70" r="14" fill="#fff" stroke="#1E3A5F" stroke-width="2"/>
      <text x="${x + 18}" y="75" text-anchor="middle" font-size="14" font-weight="700" fill="#1E3A5F">${i + 1}</text>${arrow}`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1110" height="210" ${SVG_FONT}>
    ${SVG_ARROW}
    <rect width="1110" height="210" fill="#fff"/>
    <text x="555" y="36" text-anchor="middle" font-size="22" font-weight="700" fill="#1E3A5F">Attivazione di una nuova istanza: circa 45 minuti</text>
    ${boxes}
    <text x="555" y="192" text-anchor="middle" font-size="15" fill="#6B7280">Il passo 5 è l'unico da riga di comando con accesso al database di produzione</text>
  </svg>`;
}

// ════════════════════════════════════════════════════════════════════════════

async function build() {
  await svgToPng(svgArchitettura(), 'dev-architettura.png');
  await svgToPng(svgProcedura(), 'dev-procedura.png');

  const children = [
    ...cover('GUIDA SVILUPPATORE', 'Attivazione di una nuova istanza su Vercel', 'Affitti Brevi — una istanza per ogni ragione sociale'),
    note('Documento interno Innogea. Contiene riferimenti a segreti e configurazioni: non consegnarlo ai clienti.'),
    ...spacer(),
    makeTable(
      ['Sezione', 'Argomento'],
      [
        ['1', 'Modello di deploy'],
        ['2', 'Prerequisiti'],
        ['3', 'Interventi sul repository prima della prima replica (bloccanti)'],
        ['4', 'Procedura di attivazione passo per passo'],
        ['5', 'Variabili d\'ambiente'],
        ['6', 'Aggiornamenti, modifiche allo schema e rollback'],
        ['7', 'Backup, dismissione e registro delle istanze'],
        ['8', 'Risoluzione problemi'],
      ],
      [15, 85]
    ),
    pageBreak(),

    // 1. Modello
    h1('1. MODELLO DI DEPLOY'),
    p('Ogni ragione sociale ha un progetto Vercel e un database Neon dedicati. Tutti i progetti sono collegati allo stesso repository GitHub: un push su main aggiorna tutte le istanze.'),
    ...await figure('dev-architettura.png', 'Figura 1 — Architettura multi-istanza'),
    p('La scelta è obbligata dallo stato attuale del codice, che non isola i dati tra strutture:'),
    bullet('entrate, uscite, biancheria e impostazioni non hanno struttura_id'),
    bullet('la struttura attiva arriva da un cookie non verificato lato server; gli utenti non sono legati alle strutture'),
    bullet('/api/strutture restituisce a ogni utente loggato le credenziali Alloggiati Web e del channel manager'),
    bullet('il ripristino del backup cancella i dati di tutte le strutture'),
    ...spacer(),
    note('Più strutture della stessa ragione sociale possono convivere nella stessa istanza (selettore strutture). Ragioni sociali diverse: sempre istanze diverse.'),
    pageBreak(),

    // 2. Prerequisiti
    h1('2. PREREQUISITI'),
    makeTable(
      ['Elemento', 'Dettaglio'],
      [
        ['Account Vercel', 'Membro del team con permesso di creare progetti. Il piano Hobby non consente uso commerciale: serve un team Pro'],
        ['Repository', 'github.com/giuadelcasapalermo-spec/affitti-brevi (branch main) con accesso dall\'integrazione GitHub di Vercel'],
        ['Strumenti locali', 'Node.js 24, Git, Vercel CLI (npm i -g vercel, poi vercel login)'],
        ['Repository locale', 'Clone aggiornato con npm install eseguito (serve @neondatabase/serverless per lo script di init)'],
        ['Dati del titolare', 'Raccolti con la sezione 2 della Guida per il titolare: dati societari, CIN/CIR, Alloggiati Web, iCal, regole tassa'],
        ['Slug del cliente', 'Identificativo breve e stabile, es. rossi-casa. Nome progetto: ab-<slug>'],
      ],
      [30, 70]
    ),
    ...spacer(),
    tip('Valutare di trasferire il repository in un\'organizzazione GitHub Innogea: oggi è sotto l\'account di un singolo cliente.'),
    pageBreak(),

    // 3. Preparazione del repository
    h1('3. PREPARAZIONE DEL REPOSITORY (BRANCH multi-istanza)'),
    p('Il branch multi-istanza rimuove dal codice dati e configurazioni della prima struttura:'),
    makeTable(
      ['File', 'Problema', 'Intervento'],
      [
        ['data/*.json', 'Dati e hash password del primo cliente versionati', 'Fatto: tolti dal repository e aggiunti a .gitignore. Restano nella history: valutare la pulizia'],
        ['app/api/pulizie/route.ts', 'Leggeva data/prenotazioni.json; nomi del personale nel codice', 'Fatto: route eliminata (non era usata)'],
        ['invia-istruzioni/route.ts', 'Testo check-in di Palermo nel codice', 'Fatto: modello per struttura (istruzioni_checkin) con segnaposto {ospite} {camera} {tassa} {indirizzo} {struttura}'],
        ['tassa-soggiorno/*', 'Regola "max 4 notti" fissa', 'Fatto: regole.tassa_max_notti per struttura (default 4)'],
        ['lib/pulizie.ts', 'Costi pulizia fissi', 'Fatto: regole.costo_pulizia_checkout e costo_cambio_stanza (default 7 € e 4 €)'],
        ['lib/googlesheets.ts', 'ID foglio del primo cliente come fallback', 'Fatto: ID da Impostazioni o GOOGLE_SHEET_ID, altrimenti errore esplicito'],
        ['lib/strutture.ts', 'Mancavano ragione sociale, P.IVA, CF, CIN, CIR', 'Fatto: colonna dati_fiscali, compilata dal wizard'],
      ],
      [26, 32, 42]
    ),
    ...spacer(),
    h2('3.1 Prima del deploy del branch sull\'istanza di Palermo'),
    warn('Il testo di check-in di Palermo non è più nel codice. Va copiato nel suo database PRIMA del deploy, altrimenti "Invia istruzioni check-in" risponde con un errore.'),
    bullet('Eseguire lo script una tantum migra-palermo.mjs, fornito a parte e non versionato (contiene codici porta e Wi-Fi)'),
    bullet('Lo script segnala se manca google_sheet_id: in quel caso impostarlo in Altro → Sheets o aggiungere GOOGLE_SHEET_ID al progetto affitti-brevi'),
    bullet('Le istanze esistenti non vedono il wizard: si attiva solo dove init-istanza.mjs ha scritto setup_wizard = da_fare'),
    pageBreak(),

    // 4. Procedura
    h1('4. PROCEDURA DI ATTIVAZIONE'),
    ...await figure('dev-procedura.png', 'Figura 2 — I sei passi dell\'attivazione'),
    stepBox(1, 'Creare il progetto Vercel', [
      'Dashboard Vercel → Add New → Project → Import dal repository affitti-brevi',
      'Nome progetto: ab-<slug>; framework Next.js rilevato in automatico; nessuna modifica a build e output',
      'Non avviare ancora il deploy: prima servono database e variabili (se parte, fallirà senza danni)',
      'La regione fra1 e il cron giornaliero sono già definiti in vercel.json',
    ]),
    ...spacer(),
    stepBox(2, 'Creare il database Neon', [
      'Progetto ab-<slug> → Storage → Create Database → Neon (Vercel Marketplace)',
      'Regione: AWS eu-central-1 (Francoforte), vicina alle funzioni in fra1',
      'Nome database: ab-<slug>; collegarlo agli ambienti Production e Preview',
      'L\'integrazione crea da sola la variabile DATABASE_URL nel progetto',
    ]),
    ...spacer(),
    stepBox(3, 'Impostare le variabili d\'ambiente', [
      'Vedi la tabella nella sezione 5; i segreti vanno generati nuovi per ogni istanza',
      'Da riga di comando, nella cartella del repository:',
    ]),
    ...code('vercel link --project ab-<slug>\nopenssl rand -hex 32 | vercel env add AUTH_SECRET production\nopenssl rand -hex 32 | vercel env add CRON_SECRET production\nvercel env add NEXT_PUBLIC_BASE_URL production     # https://ab-<slug>.vercel.app\nvercel env add GEMINI_API_KEY production'),
    ...spacer(),
    stepBox(4, 'Primo deploy in produzione', [
      'vercel --prod  (oppure Redeploy dalla dashboard)',
      'Verificare che il build termini senza errori e che /login risponda',
    ]),
    ...spacer(),
    stepBox(5, 'Inizializzare il database e creare l\'amministratore', [
      'Lo script crea le 5 tabelle base, disattiva Google Sheets e crea l\'utente admin',
      'Si rifiuta di procedere se il database contiene già utenti',
      'La password temporanea è stampata una sola volta: comunicarla al titolare su un canale separato',
    ]),
    ...code('vercel env pull .env.ab-<slug> --environment=production\nnode --env-file=.env.ab-<slug> scripts/init-istanza.mjs --admin <username> --nome-app "<Nome struttura>"\nrm .env.ab-<slug>'),
    ...spacer(),
    warn('Controllare che l\'host del database stampato dallo script sia quello della nuova istanza prima di proseguire. Cancellare subito il file .env pullato.'),
    ...spacer(),
    stepBox(6, 'Configurazione guidata e verifica', [
      'Al primo accesso l\'app crea struttura e tabelle mancanti e apre il wizard /configurazione',
      '8 passi: titolare (ragione sociale, P.IVA, CF, PEC), struttura (CIN, CIR, tipologia), camere e prezzi, iCal, Alloggiati Web, tassa e pulizie, testo check-in, riepilogo',
      'Conviene farlo compilare al titolare: così le credenziali Alloggiati Web non passano da Innogea',
      'Si può riaprire in qualsiasi momento da Altro → Strutture → Configurazione guidata',
      'Altro → Account: cambiare la password dell\'admin e creare gli utenti del titolare; poi la checklist qui sotto',
    ]),
    ...spacer(),
    h2('4.1 Checklist di verifica'),
    makeTable(
      ['Verifica', 'Fatto'],
      [
        ['Login con l\'admin riuscito su https://ab-<slug>.vercel.app', '☐'],
        ['Calendario vuoto: nessuna prenotazione di altri clienti', '☐'],
        ['Prima Nota e Dashboard vuote', '☐'],
        ['Sync iCal importa le prenotazioni del titolare', '☐'],
        ['Link iCal in uscita raggiungibile senza login', '☐'],
        ['Invio di prova ad Alloggiati Web riuscito', '☐'],
        ['Email di registrazione ospite ricevuta (se Gmail configurato)', '☐'],
        ['Cron /api/cron/sync risponde 401 senza CRON_SECRET', '☐'],
        ['Istanza aggiunta al registro (sezione 7)', '☐'],
      ],
      [80, 20]
    ),
    ...spacer(),
    h2('4.2 Dominio personalizzato (facoltativo)'),
    bullet('Progetto → Settings → Domains → aggiungere es. gestione.<dominio-cliente>.it e configurare il DNS indicato'),
    bullet('Aggiornare NEXT_PUBLIC_BASE_URL con il nuovo dominio e rifare il deploy: i link inviati agli ospiti usano questa variabile'),
    pageBreak(),

    // 5. Env vars
    h1('5. VARIABILI D\'AMBIENTE'),
    makeTable(
      ['Variabile', 'Necessità', 'Valore per la nuova istanza'],
      [
        ['DATABASE_URL', 'Obbligatoria', 'Creata dall\'integrazione Neon'],
        ['AUTH_SECRET', 'Obbligatoria', 'Nuova, casuale (32 byte hex). Mai riusarla: il token contiene solo lo username, con lo stesso segreto una sessione varrebbe su più istanze'],
        ['CRON_SECRET', 'Obbligatoria', 'Nuova, casuale. Se manca, /api/cron/sync è richiamabile da chiunque'],
        ['NEXT_PUBLIC_BASE_URL', 'Obbligatoria', 'URL pubblico dell\'istanza. Se manca, i link agli ospiti puntano a affittibrevi.vercel.app (primo cliente)'],
        ['GEMINI_API_KEY', 'Consigliata', 'Scansione documenti e input vocale; si può usare una chiave Innogea, con consumi condivisi'],
        ['GOOGLE_CLIENT_ID / _SECRET / _REFRESH_TOKEN', 'Per le email', 'Account Gmail del titolare; refresh token con scripts/get-gmail-token.ts. Senza, il link documenti non parte'],
        ['GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_SHEET_NAME', 'Facoltative', 'Solo se il titolare usa Google Sheets, con un foglio suo'],
        ['TWILIO_*', 'Facoltative', 'Solo per WhatsApp/SMS automatici'],
        ['BOOKING_*', 'Facoltative', 'Solo con channel manager Booking.com attivo'],
        ['GITHUB_TOKEN, GITHUB_REPO', 'Da non impostare', 'Vecchio salvataggio su GitHub, non più usato'],
      ],
      [30, 18, 52]
    ),
    ...spacer(),
    warn('Non copiare le variabili dal progetto affitti-brevi originale: GOOGLE_*, TWILIO_* e BOOKING_* punterebbero agli account del primo cliente.'),
    pageBreak(),

    // 6. Aggiornamenti
    h1('6. AGGIORNAMENTI, SCHEMA E ROLLBACK'),
    h2('6.1 Rilascio di una nuova versione'),
    bullet('Un push su main avvia il build di tutti i progetti collegati al repository'),
    bullet('Lavorare su un branch: ogni progetto genera un Preview deploy da provare prima del merge'),
    bullet('Per un rilascio graduale, provare prima su un\'istanza di test con dati fittizi'),
    h2('6.2 Modifiche al database'),
    p('Non ci sono migrazioni versionate: l\'app crea tabelle e colonne al primo uso con CREATE TABLE IF NOT EXISTS e ALTER TABLE ADD COLUMN IF NOT EXISTS. Ogni istanza si aggiorna da sola al primo accesso dopo il deploy.'),
    bullet('Mantenere questo schema per ogni nuova colonna: nessun intervento manuale sui singoli database'),
    bullet('Una nuova tabella base, letta prima di essere creata dal codice, va aggiunta anche a scripts/init-istanza.mjs'),
    bullet('Mai rinominare o eliminare colonne con un deploy unico: prima aggiungere, poi migrare, poi rimuovere'),
    h2('6.3 Rollback'),
    bullet('Per istanza: dashboard → Deployments → Instant Rollback, oppure vercel rollback --scope <team> dal progetto collegato'),
    bullet('Il rollback riporta il codice, non il database: le colonne aggiunte restano (ed è innocuo)'),
    pageBreak(),

    // 7. Backup, dismissione, registro
    h1('7. BACKUP, DISMISSIONE E REGISTRO'),
    h2('7.1 Backup'),
    bullet('Neon: ripristino point-in-time secondo la retention del piano; verificarla sul progetto Neon'),
    bullet('Applicativo: Altro → Sistema → Esporta backup (JSON)'),
    ...spacer(),
    warn('Il ripristino da Altro → Sistema cancella tutte le prenotazioni, entrate e uscite dell\'istanza prima di reimportare. Usarlo solo su istanza dedicata e dopo un export.'),
    h2('7.2 Dismissione di un\'istanza'),
    bullet('Export completo consegnato al titolare, come previsto dall\'accordo art. 28'),
    bullet('Eliminare il database Neon, poi il progetto Vercel; revocare le eventuali chiavi dedicate'),
    bullet('Aggiornare il registro'),
    h2('7.3 Registro delle istanze'),
    p('Tenere un registro aggiornato, fuori dal repository:'),
    makeTable(
      ['Slug', 'Ragione sociale', 'P.IVA', 'CIN', 'URL', 'Database Neon', 'Attivata il', 'Admin'],
      [
        ['esempio', 'Esempio S.r.l.', '…', '…', 'ab-esempio.vercel.app', 'ab-esempio', 'gg/mm/aaaa', '…'],
      ],
      [10, 16, 11, 10, 17, 13, 12, 11]
    ),
    pageBreak(),

    // 8. Troubleshooting
    h1('8. RISOLUZIONE PROBLEMI'),
    makeTable(
      ['Sintomo', 'Causa probabile', 'Soluzione'],
      [
        ['500 al login: "AUTH_SECRET non configurato"', 'Variabile mancante o aggiunta dopo il deploy', 'Aggiungerla e rifare il deploy'],
        ['500 ovunque: relation "prenotazioni" does not exist', 'Passo 5 non eseguito', 'Lanciare scripts/init-istanza.mjs'],
        ['Login "Credenziali non valide" subito dopo l\'init', 'Script eseguito su un altro database', 'Controllare l\'host stampato e il file .env usato'],
        ['I link agli ospiti puntano a un altro dominio', 'NEXT_PUBLIC_BASE_URL errata', 'Correggere e rifare il deploy (è letta al build)'],
        ['Compaiono prenotazioni di un altro cliente', 'DATABASE_URL copiata da un altro progetto', 'Fermare l\'istanza, correggere la variabile, verificare quali dati sono stati esposti'],
        ['Script di init: "contiene già N utenti"', 'Database non nuovo', 'Verificare il progetto; --force solo se è davvero un\'istanza vuota'],
      ],
      [30, 32, 38]
    ),
    ...spacer(2),
    versione('Documento v1.0 — 29/09/2026 — Innogea S.r.L — uso interno'),
  ];

  return new Document({
    styles: docStyles,
    sections: [{
      properties: { page: { margin: pageMargins } },
      footers: { default: footer('Guida sviluppatore — Nuova istanza Vercel') },
      children,
    }],
  });
}

const buf = await Packer.toBuffer(await build());
fs.writeFileSync('./GUIDA_SVILUPPATORE_NUOVA_ISTANZA.docx', buf);
console.log('✅ Generato: GUIDA_SVILUPPATORE_NUOVA_ISTANZA.docx');
