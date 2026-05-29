import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, convertInchesToTwip,
} from 'docx';
import fs from 'fs';

const BLUE      = '1E3A5F';
const BLUE_LIGHT = 'EBF0F7';
const GREEN     = '166534';
const GRAY      = '6B7280';

function h1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 120 },
    run: { color: BLUE, bold: true },
  });
}

function h2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 80 },
  });
}

function h3(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 60 },
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, ...opts })],
    spacing: { after: 80 },
  });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    children: [new TextRun({ text })],
    spacing: { after: 40 },
  });
}

function code(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: 'Courier New', size: 18, color: '1F2937' })],
    spacing: { after: 40, before: 40 },
    indent: { left: convertInchesToTwip(0.4) },
    shading: { type: ShadingType.SOLID, color: 'F3F4F6' },
  });
}

function tableRow(cells, isHeader = false) {
  return new TableRow({
    tableHeader: isHeader,
    children: cells.map((text, i) =>
      new TableCell({
        shading: isHeader ? { type: ShadingType.SOLID, color: BLUE } : (i === 0 ? { type: ShadingType.SOLID, color: BLUE_LIGHT } : undefined),
        children: [new Paragraph({
          children: [new TextRun({
            text,
            bold: isHeader || i === 0,
            color: isHeader ? 'FFFFFF' : '111827',
            size: 18,
          })],
          spacing: { before: 60, after: 60 },
        })],
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
      })
    ),
  });
}

function makeTable(header, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
      left:   { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
      right:  { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
      insideH: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
      insideV: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
    },
    rows: [tableRow(header, true), ...rows.map(r => tableRow(r))],
  });
}

function spacer() {
  return new Paragraph({ text: '', spacing: { after: 80 } });
}

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: 'Calibri', size: 22, color: '1F2937' } },
    },
    paragraphStyles: [
      {
        id: 'Heading1',
        name: 'Heading 1',
        basedOn: 'Normal',
        run: { bold: true, size: 28, color: BLUE, font: 'Calibri' },
        paragraph: { spacing: { before: 400, after: 120 } },
      },
      {
        id: 'Heading2',
        name: 'Heading 2',
        basedOn: 'Normal',
        run: { bold: true, size: 24, color: '374151', font: 'Calibri' },
        paragraph: { spacing: { before: 320, after: 80 } },
      },
      {
        id: 'Heading3',
        name: 'Heading 3',
        basedOn: 'Normal',
        run: { bold: true, size: 22, color: '4B5563', font: 'Calibri' },
        paragraph: { spacing: { before: 200, after: 60 } },
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        margin: {
          top: convertInchesToTwip(1),
          bottom: convertInchesToTwip(1),
          left: convertInchesToTwip(1.2),
          right: convertInchesToTwip(1.2),
        },
      },
    },
    children: [
      // Cover
      new Paragraph({
        children: [new TextRun({ text: 'MESSA IN SICUREZZA', bold: true, size: 40, color: BLUE, font: 'Calibri' })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 800, after: 120 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Booking.com Connectivity Partner', size: 28, color: GRAY, font: 'Calibri' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Specifica Tecnica di Sicurezza', size: 24, color: GRAY, font: 'Calibri', italics: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
      makeTable(
        ['Campo', 'Valore'],
        [
          ['Applicativo', 'Affitti Brevi Palermo'],
          ['URL', 'https://affittibrevi.vercel.app'],
          ['Referente', 'Dario Santagati — d.santagati@innogea.com'],
          ['Azienda', 'Innogea S.r.L'],
          ['Versione documento', '2.0'],
          ['Data', '05/05/2026'],
          ['Stack', 'Next.js 16 · PostgreSQL (Neon) · Vercel'],
        ]
      ),
      spacer(),

      // 1. Auth
      h1('1. AUTENTICAZIONE E AUTORIZZAZIONE'),
      h2('1.1 Autenticazione utente (interfaccia web)'),
      makeTable(
        ['Meccanismo', 'Dettaglio'],
        [
          ['Algoritmo hash password', 'PBKDF2-SHA256 · 600.000 iterazioni (NIST SP 800-132, 2023)'],
          ['Salt', '16 byte random per utente (crypto.randomBytes)'],
          ['Migrazione silenziosa', 'Hash legacy a 10.000 iter. aggiornati automaticamente al login successivo'],
          ['Token sessione', 'JWT custom · HMAC-SHA256 · firma con AUTH_SECRET (256 bit)'],
          ['Confronto firma', 'crypto.timingSafeEqual — immune a timing attacks'],
          ['Scadenza token', '7 giorni · verificata server-side ad ogni richiesta'],
          ['Trasporto token', 'Cookie httpOnly — non accessibile da JavaScript'],
        ]
      ),
      spacer(),
      h2('1.2 Middleware di autenticazione globale'),
      p('Ogni richiesta HTTP — incluse tutte le API REST — passa per il middleware proxy.ts che verifica la firma HMAC del token prima di lasciar transitare la richiesta.'),
      p('Endpoint pubblici (whitelist esplicita):', { bold: true }),
      bullet('/login'),
      bullet('/api/auth/login'),
      bullet('/api/ical/[cameraId]   ← feed iCal export (sola lettura, nessun dato sensibile)'),
      p('Qualsiasi altra rotta, inclusi /api/prenotazioni, /api/impostazioni, /api/sync, ritorna HTTP 302 → /login se il token è assente o non valido.'),
      spacer(),
      h2('1.3 Webhook Booking.com — POST /api/webhooks/booking'),
      makeTable(
        ['Controllo', 'Implementazione'],
        [
          ['Firma HMAC', 'Header x-booking-signature verificato contro BOOKING_WEBHOOK_SECRET'],
          ['Fail-secure', 'Se BOOKING_WEBHOOK_SECRET non configurato → richiesta rifiutata'],
          ['Idempotenza', 'event_id salvato in webhook_events · doppio invio → 200 OK senza riprocessamento'],
          ['Risposta immediata', '200 OK restituito prima del processing (via after() di Next.js) · no timeout'],
          ['Audit trail', 'Ogni evento salvato con stato processato/errore e timestamp'],
        ]
      ),
      spacer(),

      // 2. Integrità
      h1('2. INTEGRITÀ DEI DATI E ANTI-OVERBOOKING'),
      h2('2.1 Transazioni atomiche (PostgreSQL)'),
      p('Ogni operazione che modifica disponibilità e prenotazione è eseguita in una singola transazione PostgreSQL (BEGIN / COMMIT). Impossibile che due prenotazioni concorrenti blocchino le stesse date.'),
      spacer(),
      p('reservation.new:', { bold: true }),
      code('BEGIN'),
      code('  SELECT ... FOR UPDATE   ← lock pessimistico sulle date'),
      code('  verifica disponibilità  ← se occupato → ROLLBACK (OVERBOOKING)'),
      code('  INSERT availability     ← marca date non disponibili'),
      code('  INSERT prenotazioni     ← crea prenotazione'),
      code('COMMIT'),
      spacer(),
      p('reservation.modify:', { bold: true }),
      code('BEGIN'),
      code('  SELECT prenotazione esistente'),
      code('  UPDATE availability (vecchie date → disponibile)'),
      code('  SELECT ... FOR UPDATE (nuove date)'),
      code('  verifica disponibilità'),
      code('  UPDATE availability (nuove date → non disponibile)'),
      code('  UPDATE prenotazioni'),
      code('COMMIT'),
      spacer(),
      p('reservation.cancel:', { bold: true }),
      code('BEGIN'),
      code('  SELECT prenotazione esistente'),
      code('  UPDATE availability (date → disponibile)'),
      code('  UPDATE prenotazioni SET stato = \'cancellata\''),
      code('COMMIT'),
      spacer(),
      h2('2.2 Idempotenza degli eventi webhook'),
      p('La tabella webhook_events registra ogni event_id ricevuto con PRIMARY KEY. Un secondo invio dello stesso evento restituisce 200 OK senza modificare i dati. Questo gestisce i retry automatici di Booking.com senza effetti collaterali.'),
      spacer(),
      h2('2.3 ARI push — Availability, Rates, Inventory'),
      p('Dopo ogni modifica alla disponibilità il sistema invia un push ARI con payload completo e coerente. Il push è protetto da retry con backoff lineare (3 tentativi: 500ms / 1000ms / 1500ms).'),
      code('POST <BOOKING_ARI_ENDPOINT>'),
      code('Authorization: Bearer <BOOKING_API_KEY>'),
      code('{'),
      code('  "room_id": <id>,'),
      code('  "availability": [{ "date": "YYYY-MM-DD", "available": false }],'),
      code('  "rates": [{ "date": "YYYY-MM-DD", "price": <prezzo> }]'),
      code('}'),
      spacer(),

      // 3. Infrastruttura
      h1('3. SICUREZZA DELL\'INFRASTRUTTURA'),
      h2('3.1 Hosting — Vercel'),
      makeTable(
        ['Requisito', 'Stato'],
        [
          ['TLS 1.2+ obbligatorio su tutti gli endpoint', '✅ Enforced da Vercel'],
          ['HTTPS redirect automatico', '✅'],
          ['Certificati gestiti automaticamente', '✅ Let\'s Encrypt via Vercel'],
          ['Isolamento funzioni serverless', '✅ Ogni invocazione è isolata'],
          ['Conformità ISO 27001', '✅ Vercel certificato'],
          ['Conformità SOC 2 Type II', '✅ Vercel certificato'],
        ]
      ),
      spacer(),
      h2('3.2 Database — Neon PostgreSQL'),
      makeTable(
        ['Requisito', 'Stato'],
        [
          ['Cifratura in transito', '✅ SSL/TLS obbligatorio (sslmode=require + channel_binding=require)'],
          ['Cifratura at rest', '✅ AES-256 (Neon managed)'],
          ['Conformità SOC 2 Type II', '✅ Neon certificato'],
          ['Backup automatici', '✅ Point-in-Time Recovery (Neon)'],
          ['Accesso rete', '✅ Solo tramite DATABASE_URL con credenziali (no IP pubblici diretti)'],
        ]
      ),
      spacer(),
      h2('3.3 Variabili d\'ambiente e segreti'),
      p('Tutti i segreti sono configurati come variabili d\'ambiente cifrate su Vercel. Nessun segreto è presente nel codice sorgente, nei log o in file di configurazione versionati.'),
      makeTable(
        ['Variabile', 'Scopo'],
        [
          ['DATABASE_URL', 'Connessione PostgreSQL (include credenziali)'],
          ['AUTH_SECRET', 'Firma token sessione HMAC-SHA256'],
          ['BOOKING_WEBHOOK_SECRET', 'Verifica firma webhook Booking.com'],
          ['BOOKING_API_KEY', 'Bearer token per push ARI'],
          ['BOOKING_ARI_ENDPOINT', 'URL endpoint ARI Booking.com'],
          ['GOOGLE_CLIENT_ID/SECRET', 'OAuth2 Google Sheets/Gmail'],
          ['GEMINI_API_KEY', 'Google AI (parsing vocale — uso interno)'],
        ]
      ),
      spacer(),

      // 4. Dati ospiti
      h1('4. PROTEZIONE DEI DATI OSPITI (GDPR)'),
      h2('4.1 Dati raccolti'),
      p('I dati personali degli ospiti sono limitati a quanto strettamente necessario:'),
      bullet('Nome e cognome'),
      bullet('Email (opzionale)'),
      bullet('Telefono (opzionale)'),
      bullet('Date check-in / check-out'),
      bullet('Importo soggiorno e tassa di soggiorno'),
      spacer(),
      h2('4.2 Modalità di accesso'),
      bullet('I dati sono accessibili solo agli utenti autenticati del PMS'),
      bullet('Nessuna API pubblica espone dati degli ospiti'),
      bullet('Il feed iCal pubblico espone solo date di occupazione (SUMMARY anonimizzato)'),
      spacer(),
      h2('4.3 Conservazione'),
      p('I dati sono conservati nel database PostgreSQL per la durata necessaria alla gestione contabile e fiscale (5 anni, obbligo di legge italiano). Non sono trasferiti a terze parti fatta eccezione per i sistemi esplicitamente configurati dall\'operatore (Google Sheets per prima nota).'),
      spacer(),

      // 5. Gestione errori
      h1('5. GESTIONE DEGLI ERRORI E OSSERVABILITÀ'),
      makeTable(
        ['Scenario', 'Comportamento'],
        [
          ['Webhook con firma errata', '401 Unauthorized — evento ignorato'],
          ['Webhook con JSON malformato', '400 Bad Request — evento ignorato'],
          ['Overbooking rilevato', 'ROLLBACK transazione · evento marcato errore · 200 OK a Booking.com (no retry)'],
          ['ARI push fallito', 'Retry 3× con backoff · se tutti falliti → errore loggato, prenotazione già registrata'],
          ['Doppio invio stesso evento', '200 OK · nessuna modifica ai dati · idempotente'],
          ['Database non raggiungibile', 'Eccezione loggata · evento marcato errore · 200 OK (no retry infinito)'],
        ]
      ),
      spacer(),

      // 6. Checklist
      h1('6. CHECKLIST CONFORMITÀ BOOKING.COM CONNECTIVITY PARTNER'),
      makeTable(
        ['Requisito', 'Stato', 'Note'],
        [
          ['HTTPS su tutti gli endpoint', '✅', 'Enforced da Vercel'],
          ['Autenticazione webhook (firma HMAC)', '✅', 'Header x-booking-signature'],
          ['Risposta 200 OK entro timeout', '✅', 'Risposta immediata, processing asincrono'],
          ['Idempotenza eventi', '✅', 'Tabella webhook_events con event_id PK'],
          ['Anti-overbooking transazionale', '✅', 'SELECT FOR UPDATE + BEGIN/COMMIT'],
          ['ARI push coerente e completo', '✅', 'Payload availability + rates ad ogni modifica'],
          ['Retry ARI su fallimento', '✅', '3 tentativi con backoff lineare'],
          ['Audit trail eventi webhook', '✅', 'Tabella webhook_events con stato e timestamp'],
          ['Cifratura dati in transito', '✅', 'TLS 1.2+ su tutti i canali'],
          ['Cifratura dati at rest', '✅', 'Neon AES-256'],
          ['Segreti in variabili d\'ambiente', '✅', 'Nessun segreto hardcoded nel codice'],
          ['Conformità SOC 2 infrastruttura', '✅', 'Vercel + Neon entrambi certificati'],
          ['Gestione dati personali (GDPR)', '✅', 'Minimizzazione dati, accesso autenticato'],
        ]
      ),
      spacer(),

      // Footer
      new Paragraph({
        children: [
          new TextRun({ text: 'Documento preparato il 05/05/2026 — Versione 2.0', color: GRAY, size: 18, italics: true }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Aggiornato a seguito di hardening architetturale: transazioni atomiche, idempotenza webhook, ARI push con retry.', color: GRAY, size: 18, italics: true }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
      }),
    ],
  }],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync('./SECURITY_BOOKING_PARTNER.docx', buffer);
console.log('✅ Documento generato: SECURITY_BOOKING_PARTNER.docx');
