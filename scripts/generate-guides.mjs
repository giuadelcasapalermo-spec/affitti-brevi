import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, convertInchesToTwip, PageBreak,
} from 'docx';
import fs from 'fs';

// ─── Palette ────────────────────────────────────────────────────────────────
const BLUE       = '1E3A5F';
const BLUE_LIGHT = 'EBF0F7';
const BLUE_MID   = '2563EB';
const GRAY       = '6B7280';
const GREEN      = '166534';
const GREEN_LIGHT= 'DCFCE7';
const AMBER      = '92400E';
const AMBER_LIGHT= 'FEF3C7';
const RED        = '991B1B';

// ─── Helpers ────────────────────────────────────────────────────────────────
const pageMargins = {
  top: convertInchesToTwip(1),
  bottom: convertInchesToTwip(1),
  left: convertInchesToTwip(1.2),
  right: convertInchesToTwip(1.2),
};

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, color: BLUE, size: 30, font: 'Calibri' })],
    spacing: { before: 480, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 4 } },
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, color: '1D4ED8', size: 24, font: 'Calibri' })],
    spacing: { before: 320, after: 100 },
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, bold: true, color: '374151', size: 22, font: 'Calibri' })],
    spacing: { before: 200, after: 60 },
  });
}
function p(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: 'Calibri', color: '1F2937', ...opts })],
    spacing: { after: 100 },
  });
}
function pMixed(runs) {
  return new Paragraph({
    children: runs.map(r => new TextRun({ size: 22, font: 'Calibri', color: '1F2937', ...r })),
    spacing: { after: 100 },
  });
}
function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    children: [new TextRun({ text, size: 22, font: 'Calibri', color: '1F2937' })],
    spacing: { after: 60 },
  });
}
function numbered(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'default-numbering', level },
    children: [new TextRun({ text, size: 22, font: 'Calibri', color: '1F2937' })],
    spacing: { after: 80 },
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
function spacer(n = 1) {
  return Array.from({ length: n }, () =>
    new Paragraph({ text: '', spacing: { after: 60 } })
  );
}
function note(text, color = AMBER_LIGHT, textColor = AMBER) {
  return new Paragraph({
    children: [new TextRun({ text: `ℹ  ${text}`, size: 20, font: 'Calibri', color: textColor, bold: true })],
    shading: { type: ShadingType.SOLID, color },
    spacing: { before: 100, after: 100 },
    indent: { left: convertInchesToTwip(0.2), right: convertInchesToTwip(0.2) },
  });
}
function tip(text) {
  return new Paragraph({
    children: [new TextRun({ text: `✅  ${text}`, size: 20, font: 'Calibri', color: GREEN, bold: false })],
    shading: { type: ShadingType.SOLID, color: GREEN_LIGHT },
    spacing: { before: 100, after: 100 },
    indent: { left: convertInchesToTwip(0.2), right: convertInchesToTwip(0.2) },
  });
}
function warn(text) {
  return new Paragraph({
    children: [new TextRun({ text: `⚠  ${text}`, size: 20, font: 'Calibri', color: RED, bold: true })],
    shading: { type: ShadingType.SOLID, color: 'FEE2E2' },
    spacing: { before: 100, after: 100 },
    indent: { left: convertInchesToTwip(0.2), right: convertInchesToTwip(0.2) },
  });
}
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function makeTable(header, rows, colWidths) {
  const totalCols = header.length;
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
    rows: [
      new TableRow({
        tableHeader: true,
        children: header.map((text, i) => new TableCell({
          shading: { type: ShadingType.SOLID, color: BLUE },
          width: colWidths ? { size: colWidths[i], type: WidthType.PERCENTAGE } : undefined,
          children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 20, font: 'Calibri' })], spacing: { before: 80, after: 80 } })],
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
        })),
      }),
      ...rows.map((row, ri) => new TableRow({
        children: row.map((text, i) => new TableCell({
          shading: (ri % 2 === 0 && i === 0) ? { type: ShadingType.SOLID, color: BLUE_LIGHT } : (ri % 2 === 1 ? { type: ShadingType.SOLID, color: 'F9FAFB' } : undefined),
          children: [new Paragraph({ children: [new TextRun({ text, size: 20, font: 'Calibri', color: '1F2937' })], spacing: { before: 60, after: 60 } })],
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
        })),
      })),
    ],
  });
}

function stepBox(num, title, lines) {
  const children = [
    new TableCell({
      shading: { type: ShadingType.SOLID, color: BLUE },
      width: { size: 8, type: WidthType.PERCENTAGE },
      children: [new Paragraph({ children: [new TextRun({ text: String(num), bold: true, color: 'FFFFFF', size: 28, font: 'Calibri' })], alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 } })],
      margins: { top: 80, bottom: 80, left: 80, right: 80 },
    }),
    new TableCell({
      shading: { type: ShadingType.SOLID, color: BLUE_LIGHT },
      width: { size: 92, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 22, font: 'Calibri', color: BLUE })], spacing: { before: 60, after: 40 } }),
        ...lines.map(l => new Paragraph({ children: [new TextRun({ text: l, size: 20, font: 'Calibri', color: '374151' })], spacing: { after: 40 } })),
      ],
      margins: { top: 80, bottom: 80, left: 160, right: 80 },
    }),
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 1, color: 'BFDBFE' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'BFDBFE' },
      left:   { style: BorderStyle.SINGLE, size: 1, color: 'BFDBFE' },
      right:  { style: BorderStyle.SINGLE, size: 1, color: 'BFDBFE' },
      insideH: { style: BorderStyle.NONE },
      insideV: { style: BorderStyle.NONE },
    },
    rows: [new TableRow({ children })],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// DOCUMENTO 1 — GUIDA ATTIVAZIONE NUOVO CLIENTE
// ════════════════════════════════════════════════════════════════════════════

function buildAttivazioneDoc() {
  const numbering = {
    config: [{
      reference: 'default-numbering',
      levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 360, hanging: 360 } } } }],
    }],
  };

  const children = [
    // Cover
    new Paragraph({
      children: [new TextRun({ text: 'GUIDA ATTIVAZIONE', bold: true, size: 44, color: BLUE, font: 'Calibri' })],
      alignment: AlignmentType.CENTER, spacing: { before: 600, after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Nuovo Cliente / Nuova Struttura', size: 30, color: GRAY, font: 'Calibri' })],
      alignment: AlignmentType.CENTER, spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Affitti Brevi Palermo — Sistema di Gestione PMS', size: 22, color: GRAY, font: 'Calibri', italics: true })],
      alignment: AlignmentType.CENTER, spacing: { after: 400 },
    }),
    note('Questo documento è riservato agli amministratori del sistema. Seguire i passaggi nell\'ordine indicato.'),
    ...spacer(2),

    // Panoramica
    h1('PANORAMICA DEL PROCESSO'),
    p('L\'attivazione di una nuova struttura richiede circa 30–60 minuti e si articola in 7 fasi:'),
    ...spacer(),
    makeTable(
      ['Fase', 'Attività', 'Tempo stimato'],
      [
        ['1', 'Pre-requisiti e accesso al sistema', '5 min'],
        ['2', 'Configurazione camere', '10 min'],
        ['3', 'Integrazione iCal Booking.com / Airbnb', '10 min'],
        ['4', 'Prima sincronizzazione e verifica', '5 min'],
        ['5', 'Configurazione Google Sheets (Prima Nota)', '10 min'],
        ['6', 'Creazione utenti operativi', '5 min'],
        ['7', 'Backup iniziale e verifica finale', '5 min'],
      ],
      [8, 62, 30]
    ),
    ...spacer(2),
    pageBreak(),

    // Fase 1
    h1('FASE 1 — PRE-REQUISITI'),
    h2('1.1 Credenziali necessarie'),
    makeTable(
      ['Elemento', 'Dove trovarlo'],
      [
        ['URL applicativo', 'https://affittibrevi.vercel.app'],
        ['Username amministratore', 'Fornito da Innogea S.r.L'],
        ['Password amministratore', 'Fornita da Innogea S.r.L (da cambiare al primo accesso)'],
        ['URL iCal Booking.com (per camera)', 'Extranet Booking.com → Struttura → Calendario → Esporta'],
        ['URL iCal Airbnb (se presente)', 'Airbnb host → Calendario → Disponibilità → Esporta'],
        ['Google Sheet ID (se si usa Prima Nota)', 'URL del foglio Google: .../spreadsheets/d/<ID>/...'],
      ],
      [35, 65]
    ),
    ...spacer(),
    h2('1.2 Browser consigliato'),
    bullet('Google Chrome o Microsoft Edge (versioni recenti)'),
    bullet('Abilitare i cookie di terze parti per il dominio vercel.app'),
    bullet('Connessione internet stabile (necessaria per sincronizzazione iCal)'),
    ...spacer(2),

    // Fase 2
    h1('FASE 2 — CONFIGURAZIONE CAMERE'),
    h2('2.1 Accedere alle Impostazioni'),
    stepBox(1, 'Login', ['Aprire https://affittibrevi.vercel.app', 'Inserire username e password amministratore', 'Cliccare "Accedi"']),
    ...spacer(),
    stepBox(2, 'Aprire le Impostazioni', ['Cliccare "Impostazioni" nella barra di navigazione in alto']),
    ...spacer(),
    h2('2.2 Configurare numero e nomi camere'),
    stepBox(3, 'Numero camere', ['Nella sezione "Camere", impostare il numero totale di camere/unità della struttura', 'Salvare prima di procedere']),
    ...spacer(),
    stepBox(4, 'Nomi camere', [
      'Per ogni camera, inserire il nome identificativo (es. "Camera 1", "Suite", "Monolocale")',
      'Il nome apparirà nel calendario e in tutte le reportistiche',
    ]),
    ...spacer(),
    stepBox(5, 'Prezzi per notte', [
      'Inserire il prezzo base per notte per ogni camera',
      'Questo valore è usato come riferimento nei grafici e nelle stime ricavi',
    ]),
    ...spacer(),
    tip('I colori delle camere sono assegnati automaticamente ma possono essere personalizzati per rendere il calendario più leggibile.'),
    ...spacer(2),

    // Fase 3
    pageBreak(),
    h1('FASE 3 — INTEGRAZIONE iCAL'),
    h2('3.1 Ottenere l\'URL iCal da Booking.com'),
    p('Per ogni camera/unità su Booking.com:'),
    numbered('Accedere all\'Extranet Booking.com (extranet.booking.com)'),
    numbered('Selezionare la struttura'),
    numbered('Andare su: Struttura → Disponibilità → Impostazioni disponibilità → Esporta'),
    numbered('Copiare l\'URL del feed iCal (contiene un token univoco — mantenerlo riservato)'),
    ...spacer(),
    warn('L\'URL iCal di Booking.com contiene un token segreto. Non condividerlo pubblicamente.'),
    ...spacer(),
    h2('3.2 Inserire gli URL iCal nel sistema'),
    stepBox(6, 'Configurare URL iCal', [
      'Nelle Impostazioni → sezione "Sincronizzazione iCal"',
      'Per ogni camera, incollare il relativo URL iCal di Booking.com',
      'Se la struttura è anche su Airbnb, inserire anche l\'URL iCal Airbnb',
      'Cliccare "Salva" per ogni camera',
    ]),
    ...spacer(),
    note('Il sistema supporta più URL iCal per camera. È possibile aggiungere Booking.com, Airbnb e altri canali contemporaneamente per la stessa camera.'),
    ...spacer(2),

    // Fase 4
    h1('FASE 4 — PRIMA SINCRONIZZAZIONE'),
    stepBox(7, 'Eseguire la sincronizzazione iniziale', [
      'Dalla Dashboard o dal Calendario, cliccare il pulsante "Sync iCal"',
      'Attendere il completamento (10–30 secondi)',
      'Verificare il messaggio di conferma con il numero di prenotazioni importate',
    ]),
    ...spacer(),
    h2('4.1 Verifica del Calendario'),
    p('Dopo la sincronizzazione:'),
    bullet('Aprire il Calendario e verificare che le prenotazioni esistenti siano visibili'),
    bullet('Controllare che i nomi degli ospiti siano corretti'),
    bullet('Verificare che le date corrispondano a quelle su Booking.com'),
    bullet('Le prenotazioni importate da iCal hanno il badge "BK" (Booking) o "AB" (Airbnb)'),
    ...spacer(),
    tip('Se alcune prenotazioni non appaiono, verificare che l\'URL iCal sia corretto e che la camera sia attiva su Booking.com.'),
    ...spacer(2),

    // Fase 5
    pageBreak(),
    h1('FASE 5 — GOOGLE SHEETS (PRIMA NOTA)'),
    note('Questa fase è opzionale. Saltare se non si utilizza Google Sheets per la contabilità.'),
    ...spacer(),
    h2('5.1 Preparare il Google Sheet'),
    numbered('Creare un nuovo Google Spreadsheet (o usarne uno esistente)'),
    numbered('Copiare l\'ID del foglio dall\'URL: https://docs.google.com/spreadsheets/d/[ID_QUI]/...'),
    numbered('Assicurarsi che il foglio sia condiviso con l\'account Google configurato nel sistema'),
    ...spacer(),
    h2('5.2 Configurare nel sistema'),
    stepBox(8, 'Inserire Google Sheet ID', [
      'Nelle Impostazioni → sezione "Google Sheets"',
      'Incollare l\'ID del foglio',
      'Abilitare la sincronizzazione automatica',
      'Cliccare "Salva"',
    ]),
    ...spacer(),
    h2('5.3 Struttura del foglio'),
    p('Il sistema scrive automaticamente le seguenti colonne:'),
    makeTable(
      ['Colonna', 'Contenuto'],
      [
        ['A', 'Data check-in'],
        ['B', 'Data check-out'],
        ['C', 'Nome ospite'],
        ['D', 'Camera'],
        ['E', 'Importo (€)'],
        ['F', 'Tassa di soggiorno (€)'],
        ['G', 'Canale (Booking, Airbnb, Privato)'],
        ['H', 'Note'],
      ],
      [15, 85]
    ),
    ...spacer(2),

    // Fase 6
    h1('FASE 6 — CREAZIONE UTENTI OPERATIVI'),
    h2('6.1 Tipologie di utente'),
    makeTable(
      ['Tipo', 'Accesso', 'Uso consigliato'],
      [
        ['Amministratore', 'Completo (tutte le sezioni)', 'Proprietario, gestore principale'],
        ['Operatore', 'Calendario + Dashboard + Prenotazioni', 'Staff, co-gestore'],
        ['Solo Calendario', 'Solo visualizzazione calendario', 'Addetto pulizie, fornitore esterno'],
      ],
      [20, 40, 40]
    ),
    ...spacer(),
    h2('6.2 Aggiungere un nuovo utente'),
    stepBox(9, 'Creare utente operativo', [
      'Nelle Impostazioni → sezione "Utenti"',
      'Cliccare "Aggiungi utente"',
      'Inserire username e password temporanea',
      'Selezionare il livello di accesso',
      'Comunicare le credenziali all\'operatore e richiedere il cambio password al primo accesso',
    ]),
    ...spacer(),
    warn('Non condividere le credenziali di amministratore con il personale operativo. Creare sempre utenti separati.'),
    ...spacer(2),

    // Fase 7
    pageBreak(),
    h1('FASE 7 — BACKUP INIZIALE E VERIFICA FINALE'),
    stepBox(10, 'Eseguire il backup iniziale', [
      'Nelle Impostazioni → sezione "Backup"',
      'Cliccare "Esporta backup"',
      'Salvare il file JSON in una posizione sicura (es. Google Drive, email)',
    ]),
    ...spacer(),
    h2('7.1 Checklist finale di attivazione'),
    makeTable(
      ['Verifica', 'Completato'],
      [
        ['Camere configurate (nomi, prezzi)', '☐'],
        ['URL iCal Booking.com inseriti per ogni camera', '☐'],
        ['Prima sincronizzazione completata senza errori', '☐'],
        ['Prenotazioni esistenti visibili nel calendario', '☐'],
        ['Google Sheets configurato (se applicabile)', '☐'],
        ['Utenti operativi creati', '☐'],
        ['Backup iniziale eseguito e salvato', '☐'],
        ['Test accesso con utente operativo', '☐'],
      ],
      [70, 30]
    ),
    ...spacer(),
    tip('Attivazione completata! Consegnare la Guida Utilizzo all\'operatore principale e pianificare un breve training di 15 minuti.'),
    ...spacer(2),

    // Riferimenti
    h1('RIFERIMENTI E SUPPORTO'),
    makeTable(
      ['Contatto', 'Dettaglio'],
      [
        ['Supporto tecnico', 'd.santagati@innogea.com'],
        ['Azienda', 'Innogea S.r.L'],
        ['URL applicativo', 'https://affittibrevi.vercel.app'],
        ['Documentazione sicurezza', 'SECURITY_BOOKING_PARTNER.docx'],
      ],
      [35, 65]
    ),
    ...spacer(),
    new Paragraph({
      children: [new TextRun({ text: 'Documento v1.0 — 05/05/2026 — Innogea S.r.L', color: GRAY, size: 18, italics: true, font: 'Calibri' })],
      alignment: AlignmentType.CENTER, spacing: { before: 400 },
    }),
  ];

  return new Document({
    numbering,
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22, color: '1F2937' } } },
    },
    sections: [{ properties: { page: { margin: pageMargins } }, children }],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// DOCUMENTO 2 — GUIDA UTILIZZO PER UTENTI
// ════════════════════════════════════════════════════════════════════════════

function buildUtilizzoDoc() {
  const children = [
    // Cover
    new Paragraph({
      children: [new TextRun({ text: 'GUIDA ALL\'UTILIZZO', bold: true, size: 44, color: BLUE, font: 'Calibri' })],
      alignment: AlignmentType.CENTER, spacing: { before: 600, after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Affitti Brevi Palermo — Sistema PMS', size: 30, color: GRAY, font: 'Calibri' })],
      alignment: AlignmentType.CENTER, spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Manuale operativo per utenti', size: 22, color: GRAY, font: 'Calibri', italics: true })],
      alignment: AlignmentType.CENTER, spacing: { after: 400 },
    }),
    tip('Questa guida è pensata per chi gestisce le prenotazioni quotidianamente. Non sono richieste competenze tecniche.'),
    ...spacer(2),

    // Indice
    h1('INDICE'),
    makeTable(
      ['Sezione', 'Argomento', 'Pagina'],
      [
        ['1', 'Accesso al sistema', '—'],
        ['2', 'Il Calendario', '—'],
        ['3', 'Gestire le prenotazioni', '—'],
        ['4', 'Sincronizzazione iCal', '—'],
        ['5', 'La Dashboard', '—'],
        ['6', 'Entrate e Uscite', '—'],
        ['7', 'Impostazioni', '—'],
        ['8', 'Domande frequenti', '—'],
      ],
      [10, 70, 20]
    ),
    ...spacer(2),
    pageBreak(),

    // 1. Accesso
    h1('1. ACCESSO AL SISTEMA'),
    h2('1.1 Come accedere'),
    stepBox(1, 'Aprire il browser', ['Aprire Google Chrome o Microsoft Edge']),
    ...spacer(),
    stepBox(2, 'Andare all\'indirizzo', ['https://affittibrevi.vercel.app', 'Aggiungere la pagina ai preferiti per accedere rapidamente']),
    ...spacer(),
    stepBox(3, 'Inserire le credenziali', [
      'Username: fornito dall\'amministratore',
      'Password: fornita dall\'amministratore',
      'Cliccare "Accedi"',
    ]),
    ...spacer(),
    note('La sessione rimane attiva per 7 giorni. Non è necessario fare login ogni volta dallo stesso dispositivo.'),
    ...spacer(),
    h2('1.2 Cosa vedi dopo il login'),
    p('Dopo l\'accesso compare il Calendario del mese corrente. La barra di navigazione in alto permette di spostarsi tra le sezioni:'),
    makeTable(
      ['Voce menu', 'Funzione'],
      [
        ['Calendario', 'Vista mensile delle prenotazioni per camera — punto di partenza quotidiano'],
        ['Dashboard', 'Statistiche, KPI ricavi, grafici occupazione e andamento finanziario'],
        ['Prenotazioni', 'Lista completa prenotazioni con filtri e ricerca'],
        ['Uscite', 'Registrazione spese (pulizie, utenze, manutenzione)'],
        ['Impostazioni', 'Configurazione camere, URL iCal, utenti (solo amministratori)'],
      ],
      [25, 75]
    ),
    ...spacer(2),
    pageBreak(),

    // 2. Calendario
    h1('2. IL CALENDARIO'),
    h2('2.1 Come leggere il calendario'),
    p('Il calendario mostra il mese corrente. Ogni riga è una camera; ogni colonna è un giorno.'),
    makeTable(
      ['Elemento', 'Significato'],
      [
        ['Blocco colorato', 'Camera occupata da una prenotazione (colore = camera)'],
        ['Freccia →', 'Inizio prenotazione (check-in)'],
        ['Freccia ←', 'Fine prenotazione (check-out)'],
        ['Badge "BK"', 'Prenotazione proveniente da Booking.com'],
        ['Badge "AB"', 'Prenotazione proveniente da Airbnb'],
        ['Sfondo bianco', 'Camera libera quel giorno'],
        ['Giorno evidenziato', 'Oggi'],
      ],
      [30, 70]
    ),
    ...spacer(),
    h2('2.2 Navigazione'),
    bullet('Frecce ◀ ▶ in alto: mese precedente / successivo'),
    bullet('Cliccare su un giorno: apre il pannello di dettaglio in basso'),
    bullet('Il pannello di dettaglio mostra chi è presente, in arrivo e in partenza quel giorno'),
    ...spacer(),
    h2('2.3 Pannello di dettaglio giornaliero'),
    p('Cliccando su un giorno nel calendario appare in basso il riepilogo del giorno:'),
    makeTable(
      ['Sezione', 'Contenuto'],
      [
        ['Partenze', 'Ospiti che fanno check-out oggi (importo giorno: —, totale soggiorno visibile)'],
        ['Arrivi', 'Ospiti che fanno check-in oggi'],
        ['Presenti', 'Ospiti che pernottano (né arrivo né partenza oggi)'],
        ['Totale in fondo', 'Ricavo giornaliero stimato (solo arrivi + presenti) e totale affitti'],
      ],
      [25, 75]
    ),
    ...spacer(),
    tip('Il ricavo giornaliero (€/giorno) è calcolato dividendo l\'importo totale per il numero di notti della prenotazione, escludendo il giorno di partenza.'),
    ...spacer(2),
    pageBreak(),

    // 3. Prenotazioni
    h1('3. GESTIRE LE PRENOTAZIONI'),
    h2('3.1 Creare una prenotazione manuale'),
    note('Le prenotazioni da Booking.com e Airbnb si importano automaticamente con il Sync iCal. Questo procedimento è per prenotazioni dirette.'),
    ...spacer(),
    stepBox(1, 'Aprire il form', [
      'Nel Calendario, cliccare il pulsante "+ Nuova prenotazione" (o cliccare su un giorno libero)',
    ]),
    ...spacer(),
    stepBox(2, 'Compilare i campi', [
      'Camera: selezionare dalla lista',
      'Nome ospite: nome e cognome',
      'Check-in / Check-out: selezionare le date (il sistema verifica automaticamente la disponibilità)',
      'Importo totale: importo del soggiorno in €',
      'Tassa di soggiorno: importo tassa in € (se applicabile)',
      'Telefono / Email: opzionali',
      'Note: informazioni aggiuntive',
    ]),
    ...spacer(),
    stepBox(3, 'Salvare', [
      'Cliccare "Salva prenotazione"',
      'La prenotazione appare immediatamente nel calendario',
    ]),
    ...spacer(),
    warn('Se le date selezionate sono già occupate da un\'altra prenotazione, il sistema mostra un avviso e impedisce il salvataggio. Verificare il calendario prima di procedere.'),
    ...spacer(),
    h2('3.2 Modificare una prenotazione'),
    stepBox(4, 'Aprire la prenotazione', [
      'Nel Calendario, cliccare sulla prenotazione',
      'Oppure andare in Prenotazioni → trovare la riga → cliccare l\'icona matita ✏',
    ]),
    ...spacer(),
    stepBox(5, 'Modificare e salvare', [
      'Modificare i campi necessari',
      'Cliccare "Aggiorna prenotazione"',
    ]),
    ...spacer(),
    h2('3.3 Cancellare una prenotazione'),
    stepBox(6, 'Cancellare', [
      'Trovare la prenotazione nel Calendario o nella lista Prenotazioni',
      'Cliccare l\'icona cestino 🗑',
      'Confermare la cancellazione',
      'La prenotazione viene marcata come "Cancellata" e non appare più nel calendario',
    ]),
    ...spacer(),
    note('Le prenotazioni cancellate non vengono eliminate dal database — rimangono per fini contabili e di audit. Sono visibili nella lista Prenotazioni con filtro "Cancellate".'),
    ...spacer(),
    h2('3.4 Input vocale'),
    p('Il form di prenotazione supporta l\'inserimento vocale tramite il pulsante microfono 🎙. È possibile dettare:'),
    bullet('"Camera rossa, check-in 15 maggio, check-out 20 maggio, Mario Rossi, 300 euro"'),
    p('Il sistema interpreta il testo e compila automaticamente i campi.'),
    ...spacer(2),
    pageBreak(),

    // 4. Sync iCal
    h1('4. SINCRONIZZAZIONE iCAL'),
    h2('4.1 Quando fare il sync'),
    makeTable(
      ['Situazione', 'Azione'],
      [
        ['Nuova prenotazione arrivata su Booking.com', 'Fare sync iCal per importarla'],
        ['Prenotazione cancellata su Booking.com', 'Fare sync iCal per rimuoverla'],
        ['Date modificate su Booking.com', 'Fare sync iCal per aggiornare'],
        ['Inizio della giornata lavorativa', 'Consigliato fare sync per avere dati aggiornati'],
      ],
      [50, 50]
    ),
    ...spacer(),
    h2('4.2 Come fare il sync'),
    stepBox(1, 'Avviare la sincronizzazione', [
      'Dalla Dashboard o dal Calendario, cliccare il pulsante "Sync iCal"',
      'Il pulsante mostra un\'animazione durante il processo',
      'Al termine appare un messaggio con il numero di prenotazioni importate/aggiornate',
    ]),
    ...spacer(),
    h2('4.3 Cosa importa il sync'),
    bullet('Nuove prenotazioni confermate'),
    bullet('Periodi bloccati/chiusi su Booking.com'),
    bullet('Modifica date di prenotazioni esistenti'),
    ...spacer(),
    tip('Il sync iCal è un\'operazione sicura: non elimina le prenotazioni inserite manualmente nel sistema. Aggiorna solo quelle provenienti da Booking.com/Airbnb.'),
    ...spacer(2),
    pageBreak(),

    // 5. Dashboard
    h1('5. LA DASHBOARD'),
    h2('5.1 Cosa trovi nella dashboard'),
    makeTable(
      ['Sezione', 'Informazioni'],
      [
        ['KPI principali', 'Occupazione %, ricavi totali, numero prenotazioni, tassa di soggiorno del periodo'],
        ['Camere nel periodo', 'Per ogni camera: prenotazioni, notti, ricavo totale, ricavo medio per notte'],
        ['Andamento prenotazioni', 'Vista griglia giorni × camere con occupazione visiva del periodo'],
        ['Statistiche giornaliere', 'Grafici per camera con ricavo/notte e saturazione (solo desktop)'],
        ['Entrate per categoria', 'Breakdown ricavi per canale (Booking, Airbnb, privato, ecc.)'],
        ['Uscite per categoria', 'Breakdown spese per categoria (pulizie, utenze, manutenzione, ecc.)'],
        ['Movimenti recenti', 'Lista cronologica entrate e uscite del periodo'],
      ],
      [30, 70]
    ),
    ...spacer(),
    h2('5.2 Filtri disponibili'),
    bullet('Periodo: selezionare mese/anno di riferimento con le frecce ◀ ▶'),
    bullet('Camera: filtrare per camera specifica o tutte le camere'),
    ...spacer(),
    h2('5.3 Come leggere le card "Camere nel periodo"'),
    p('Ogni card mostra per la camera selezionata nel periodo filtrato:'),
    makeTable(
      ['Indicatore', 'Significato'],
      [
        ['N pren.', 'Numero di prenotazioni nel periodo'],
        ['Nn (notti)', 'Numero totale di notti occupate'],
        ['€ TOTALE', 'Ricavo totale del periodo per quella camera'],
        ['€ X/notte', 'Ricavo medio per notte (ricavo totale ÷ notti occupate)'],
        ['Nome ospite', 'Ospite attualmente presente (se oggi è nel periodo)'],
        ['€ X/n (in grigio)', 'Prezzo base configurato per quella camera'],
      ],
      [25, 75]
    ),
    ...spacer(2),
    pageBreak(),

    // 6. Entrate e Uscite
    h1('6. ENTRATE E USCITE'),
    h2('6.1 Registrare un\'uscita (spesa)'),
    p('Le uscite sono le spese della struttura: pulizie, utenze, manutenzione, ecc.'),
    stepBox(1, 'Aprire la sezione Uscite', [
      'Cliccare "Uscite" nella barra di navigazione',
    ]),
    ...spacer(),
    stepBox(2, 'Aggiungere una spesa', [
      'Cliccare "+ Nuova uscita"',
      'Compilare: data, descrizione, importo, categoria',
      'Cliccare "Salva"',
    ]),
    ...spacer(),
    p('Categorie di uscita disponibili:'),
    makeTable(
      ['Categoria', 'Esempi'],
      [
        ['Pulizie', 'Compenso addetti pulizie, materiali pulizia'],
        ['Utenze', 'Luce, gas, acqua, internet'],
        ['Manutenzione', 'Riparazioni, piccoli lavori, sostituzione arredi'],
        ['Commissioni', 'Commissioni Booking.com, Airbnb'],
        ['Tasse', 'Tasse comunali, IMU, TARI'],
        ['Altro', 'Tutto ciò che non rientra nelle categorie precedenti'],
      ],
      [30, 70]
    ),
    ...spacer(),
    h2('6.2 Le entrate'),
    p('Le entrate vengono popolate automaticamente dalle prenotazioni. Non è necessario inserirle manualmente. Nella Dashboard → sezione Entrate per categoria, trovi il dettaglio per canale di vendita.'),
    ...spacer(2),
    pageBreak(),

    // 7. Impostazioni
    h1('7. IMPOSTAZIONI (solo amministratori)'),
    makeTable(
      ['Sezione', 'Cosa si configura'],
      [
        ['Camere', 'Numero, nomi, prezzi base, colori'],
        ['Sincronizzazione iCal', 'URL feed iCal per camera (Booking.com, Airbnb, altri)'],
        ['Google Sheets', 'ID foglio per Prima Nota automatica'],
        ['Utenti', 'Aggiunta, modifica, eliminazione utenti operativi'],
        ['Backup', 'Esportazione e importazione backup dati'],
        ['App', 'Nome applicazione, logo'],
      ],
      [30, 70]
    ),
    ...spacer(),
    warn('Le modifiche alle Impostazioni hanno effetto immediato su tutti gli utenti connessi. Procedere con attenzione, specialmente per la configurazione URL iCal.'),
    ...spacer(2),

    // 8. FAQ
    h1('8. DOMANDE FREQUENTI'),
    makeTable(
      ['Domanda', 'Risposta'],
      [
        [
          'Ho fatto una prenotazione su Booking.com ma non la vedo nel calendario',
          'Fare "Sync iCal" dalla Dashboard o dal Calendario. Se il problema persiste, verificare che l\'URL iCal della camera sia corretto nelle Impostazioni.',
        ],
        [
          'Una prenotazione mostra "Ospite Booking.com" invece del nome',
          'Booking.com a volte non include il nome ospite nel feed iCal per motivi di privacy. Il nome è visibile sull\'Extranet Booking.com.',
        ],
        [
          'Vedo prenotazioni nel 2027 che non riconosco',
          'Potrebbero essere periodi bloccati/chiusi impostati su Booking.com. Verificare sull\'Extranet Booking.com e rimuovere se non necessari.',
        ],
        [
          'Come faccio a vedere le prenotazioni cancellate?',
          'Andare in Prenotazioni → usare il filtro "Stato" → selezionare "Cancellate".',
        ],
        [
          'Posso usare il sistema da cellulare?',
          'Sì, l\'interfaccia è ottimizzata per mobile. Alcune funzionalità avanzate (grafici dettagliati) sono visibili solo da desktop.',
        ],
        [
          'Come cambio la mia password?',
          'Contattare l\'amministratore del sistema. Al momento il cambio password non è disponibile in self-service.',
        ],
        [
          'Il sync iCal ha eliminato una prenotazione che avevo inserito manualmente',
          'Il sync non elimina mai le prenotazioni manuali. Se una prenotazione manuale è scomparsa, potrebbe essere stata cancellata accidentalmente. Contattare il supporto.',
        ],
        [
          'Come esporto i dati per il commercialista?',
          'Dashboard → sezione "Movimenti" → Export Excel. Oppure usare Google Sheets se configurato (Prima Nota automatica).',
        ],
      ],
      [40, 60]
    ),
    ...spacer(2),

    // Contatti
    h1('SUPPORTO'),
    makeTable(
      ['Contatto', 'Dettaglio'],
      [
        ['Email supporto tecnico', 'd.santagati@innogea.com'],
        ['Azienda', 'Innogea S.r.L'],
        ['URL applicativo', 'https://affittibrevi.vercel.app'],
      ],
      [35, 65]
    ),
    ...spacer(),
    new Paragraph({
      children: [new TextRun({ text: 'Documento v1.0 — 05/05/2026 — Innogea S.r.L', color: GRAY, size: 18, italics: true, font: 'Calibri' })],
      alignment: AlignmentType.CENTER, spacing: { before: 400 },
    }),
  ];

  return new Document({
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22, color: '1F2937' } } },
    },
    sections: [{ properties: { page: { margin: pageMargins } }, children }],
  });
}

// ─── Generate ────────────────────────────────────────────────────────────────
const buf1 = await Packer.toBuffer(buildAttivazioneDoc());
fs.writeFileSync('./GUIDA_ATTIVAZIONE_NUOVO_CLIENTE.docx', buf1);
console.log('✅ Generato: GUIDA_ATTIVAZIONE_NUOVO_CLIENTE.docx');

const buf2 = await Packer.toBuffer(buildUtilizzoDoc());
fs.writeFileSync('./GUIDA_UTILIZZO_UTENTI.docx', buf2);
console.log('✅ Generato: GUIDA_UTILIZZO_UTENTI.docx');
