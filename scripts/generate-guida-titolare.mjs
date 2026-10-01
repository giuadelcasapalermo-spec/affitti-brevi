import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, convertInchesToTwip, PageBreak, ImageRun,
  Footer, PageNumber,
} from 'docx';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Uso: node scripts/generate-guida-titolare.mjs
// Le immagini vengono lette da scripts/guida-img/. Gli screenshot mancanti vengono saltati:
// basta aggiungere il PNG (es. calendario.png) e rigenerare.

const IMG_DIR = './scripts/guida-img';

// ─── Palette (stessa di generate-guides.mjs) ───────────────────────────────
const BLUE       = '1E3A5F';
const BLUE_LIGHT = 'EBF0F7';
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
function p(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: 'Calibri', color: '1F2937', ...opts })],
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
function spacer(n = 1) {
  return Array.from({ length: n }, () => new Paragraph({ text: '', spacing: { after: 60 } }));
}
function box(prefix, text, color, textColor, bold) {
  return new Paragraph({
    children: [new TextRun({ text: `${prefix}  ${text}`, size: 20, font: 'Calibri', color: textColor, bold })],
    shading: { type: ShadingType.SOLID, color },
    spacing: { before: 100, after: 100 },
    indent: { left: convertInchesToTwip(0.2), right: convertInchesToTwip(0.2) },
  });
}
const note = t => box('ℹ', t, AMBER_LIGHT, AMBER, true);
const tip  = t => box('✅', t, GREEN_LIGHT, GREEN, false);
const warn = t => box('⚠', t, 'FEE2E2', RED, true);
function pageBreak() { return new Paragraph({ children: [new PageBreak()] }); }

const tableBorders = {
  top:    { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
  left:   { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
  right:  { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
  insideH: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
  insideV: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
};

function makeTable(header, rows, colWidths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
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
    rows: [new TableRow({ children: [
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
    ] })],
  });
}

// Immagine centrata con didascalia; se il file non esiste restituisce [] (sezione senza immagine)
const MAX_W = 600; // px ≈ larghezza utile pagina
async function figure(file, caption) {
  const full = path.join(IMG_DIR, file);
  if (!fs.existsSync(full)) return [];
  const data = fs.readFileSync(full);
  const { width, height } = await sharp(data).metadata();
  const w = Math.min(MAX_W, width);
  const h = Math.round(height * (w / width));
  return [
    new Paragraph({
      children: [new ImageRun({ type: 'png', data, transformation: { width: w, height: h } })],
      alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: caption, italics: true, size: 18, color: GRAY, font: 'Calibri' })],
      alignment: AlignmentType.CENTER, spacing: { after: 200 },
    }),
  ];
}

// ─── Diagrammi (SVG → PNG) ──────────────────────────────────────────────────
const FONT = 'font-family="Calibri, Segoe UI, Arial, sans-serif"';

function svgArchitettura() {
  const col = (x, titolo, rs, url) => `
    <rect x="${x}" y="70" width="300" height="330" rx="14" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
    <text x="${x + 150}" y="102" text-anchor="middle" font-size="20" font-weight="700" fill="#1E3A5F">${titolo}</text>
    <text x="${x + 150}" y="126" text-anchor="middle" font-size="15" fill="#6B7280">${rs}</text>
    <rect x="${x + 30}" y="150" width="240" height="64" rx="10" fill="#2563EB"/>
    <text x="${x + 150}" y="178" text-anchor="middle" font-size="17" font-weight="700" fill="#fff">App dedicata</text>
    <text x="${x + 150}" y="200" text-anchor="middle" font-size="14" fill="#DBEAFE">${url}</text>
    <line x1="${x + 150}" y1="214" x2="${x + 150}" y2="250" stroke="#1E3A5F" stroke-width="2.5" marker-end="url(#a)"/>
    <rect x="${x + 30}" y="256" width="240" height="64" rx="10" fill="#1E3A5F"/>
    <text x="${x + 150}" y="284" text-anchor="middle" font-size="17" font-weight="700" fill="#fff">Database dedicato</text>
    <text x="${x + 150}" y="306" text-anchor="middle" font-size="14" fill="#CBD5E1">prenotazioni · ospiti · prima nota</text>
    <text x="${x + 150}" y="350" text-anchor="middle" font-size="14" fill="#374151">CIN / CIR · credenziali Alloggiati</text>
    <text x="${x + 150}" y="372" text-anchor="middle" font-size="14" fill="#374151">utenti e dati fiscali propri</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="470" ${FONT}>
    <defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#1E3A5F"/></marker></defs>
    <rect width="1100" height="470" fill="#fff"/>
    <text x="550" y="40" text-anchor="middle" font-size="22" font-weight="700" fill="#1E3A5F">Un'istanza separata per ogni ragione sociale</text>
    ${col(40, 'Titolare A', 'Ragione sociale A · CIN/CIR A', 'titolare-a.vercel.app')}
    ${col(400, 'Titolare B', 'Ragione sociale B · CIN/CIR B', 'titolare-b.vercel.app')}
    ${col(760, 'Titolare C', 'Ragione sociale C · CIN/CIR C', 'titolare-c.vercel.app')}
    <text x="550" y="450" text-anchor="middle" font-size="15" fill="#6B7280">Stesso software e stessi aggiornamenti; nessun dato condiviso tra titolari</text>
  </svg>`;
}

function svgFlussoOspite() {
  const steps = [
    ['Prenotazione', 'Booking / Airbnb', 'o diretta'],
    ['Link all\'ospite', 'email con link', 'monouso'],
    ['Documento', 'l\'ospite scansiona', 'il documento'],
    ['Scheda Alloggiati', 'verifica dati', 'del titolare'],
    ['Invio Questura', 'Alloggiati Web', 'entro 24 ore'],
    ['Tassa soggiorno', 'riepilogo', 'trimestrale'],
  ];
  const w = 160, gap = 22, x0 = 20;
  const boxes = steps.map(([t, a, b], i) => {
    const x = x0 + i * (w + gap);
    const fill = i === 4 ? '#1E3A5F' : '#2563EB';
    const arrow = i < steps.length - 1
      ? `<line x1="${x + w + 2}" y1="120" x2="${x + w + gap - 3}" y2="120" stroke="#1E3A5F" stroke-width="2.5" marker-end="url(#a)"/>` : '';
    return `<rect x="${x}" y="70" width="${w}" height="100" rx="12" fill="${fill}"/>
      <text x="${x + w / 2}" y="104" text-anchor="middle" font-size="17" font-weight="700" fill="#fff">${t}</text>
      <text x="${x + w / 2}" y="130" text-anchor="middle" font-size="14" fill="#DBEAFE">${a}</text>
      <text x="${x + w / 2}" y="150" text-anchor="middle" font-size="14" fill="#DBEAFE">${b}</text>
      <circle cx="${x + 18}" cy="70" r="14" fill="#fff" stroke="#1E3A5F" stroke-width="2"/>
      <text x="${x + 18}" y="75" text-anchor="middle" font-size="14" font-weight="700" fill="#1E3A5F">${i + 1}</text>${arrow}`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1110" height="230" ${FONT}>
    <defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#1E3A5F"/></marker></defs>
    <rect width="1110" height="230" fill="#fff"/>
    <text x="555" y="36" text-anchor="middle" font-size="22" font-weight="700" fill="#1E3A5F">Dalla prenotazione agli adempimenti</text>
    ${boxes}
    <text x="555" y="210" text-anchor="middle" font-size="15" fill="#6B7280">Passi 1–3 automatici o a cura dell'ospite · passi 4–6 a cura del titolare, dall'app</text>
  </svg>`;
}

function svgGiornata() {
  const items = [
    ['Mattina', 'Sync iCal e controllo arrivi/partenze nel Calendario'],
    ['Prima dell\'arrivo', 'Invio link documenti e istruzioni check-in'],
    ['All\'arrivo', 'Verifica schede e invio ad Alloggiati Web'],
    ['Fine giornata', 'Spese in Prima Nota e biancheria del giorno'],
  ];
  const rows = items.map(([t, d], i) => {
    const y = 70 + i * 62;
    return `<circle cx="60" cy="${y + 20}" r="10" fill="#2563EB"/>
      ${i < items.length - 1 ? `<line x1="60" y1="${y + 30}" x2="60" y2="${y + 72}" stroke="#93C5FD" stroke-width="3"/>` : ''}
      <text x="90" y="${y + 16}" font-size="18" font-weight="700" fill="#1E3A5F">${t}</text>
      <text x="90" y="${y + 38}" font-size="16" fill="#374151">${d}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="330" ${FONT}>
    <rect width="760" height="330" fill="#fff"/>
    <text x="30" y="38" font-size="22" font-weight="700" fill="#1E3A5F">La giornata tipo del titolare</text>
    ${rows}
  </svg>`;
}

async function renderDiagrams() {
  fs.mkdirSync(IMG_DIR, { recursive: true });
  const diagrams = {
    'diag-architettura.png': svgArchitettura(),
    'diag-flusso-ospite.png': svgFlussoOspite(),
    'diag-giornata.png': svgGiornata(),
  };
  for (const [file, svg] of Object.entries(diagrams)) {
    await sharp(Buffer.from(svg), { density: 144 }).png().toFile(path.join(IMG_DIR, file));
  }
  // Ritaglia la card di login dallo screenshot a pagina intera
  const raw = path.join(IMG_DIR, 'login.png');
  const crop = path.join(IMG_DIR, 'login-crop.png');
  if (fs.existsSync(raw)) {
    await sharp(raw).extract({ left: 400, top: 210, width: 480, height: 430 }).png().toFile(crop);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// GUIDA PER IL TITOLARE
// ════════════════════════════════════════════════════════════════════════════

async function buildGuidaTitolare() {
  const children = [
    // Copertina
    new Paragraph({
      children: [new TextRun({ text: 'GUIDA PER IL TITOLARE', bold: true, size: 44, color: BLUE, font: 'Calibri' })],
      alignment: AlignmentType.CENTER, spacing: { before: 600, after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Affitti Brevi — Sistema di gestione della struttura', size: 30, color: GRAY, font: 'Calibri' })],
      alignment: AlignmentType.CENTER, spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Attivazione, configurazione e uso quotidiano', size: 22, color: GRAY, font: 'Calibri', italics: true })],
      alignment: AlignmentType.CENTER, spacing: { after: 400 },
    }),
    ...await figure('login-crop.png', 'Schermata di accesso all\'applicazione'),
    tip('Questa guida accompagna il titolare dalla richiesta di attivazione fino all\'uso quotidiano. Non servono competenze tecniche.'),
    pageBreak(),

    // Indice
    h1('INDICE'),
    makeTable(
      ['Sezione', 'Argomento'],
      [
        ['1', 'Come funziona il servizio'],
        ['2', 'Dati da fornire per l\'attivazione'],
        ['3', 'Primo accesso'],
        ['4', 'Configurazione iniziale della struttura'],
        ['5', 'Uso quotidiano: calendario e prenotazioni'],
        ['6', 'Ospiti e adempimenti: Alloggiati Web e tassa di soggiorno'],
        ['7', 'Prima Nota, Dashboard e dati per il commercialista'],
        ['8', 'Privacy e sicurezza dei dati'],
        ['9', 'Checklist di avvio'],
        ['10', 'Domande frequenti e supporto'],
      ],
      [15, 85]
    ),
    pageBreak(),

    // 1. Come funziona
    h1('1. COME FUNZIONA IL SERVIZIO'),
    p('Ogni titolare riceve un\'istanza dedicata dell\'applicazione: un indirizzo web proprio e un database proprio. I dati di una ragione sociale non sono mai visibili ad altri titolari.'),
    ...await figure('diag-architettura.png', 'Figura 1 — Ogni ragione sociale ha app e database separati'),
    makeTable(
      ['Cosa è separato', 'Perché conta'],
      [
        ['Indirizzo web e utenti', 'Solo le persone autorizzate dal titolare accedono alla sua istanza'],
        ['Database', 'Prenotazioni, ospiti e movimenti restano distinti per ragione sociale'],
        ['CIN, CIR e dati fiscali', 'Ogni struttura comunica con i propri codici, senza rischio di scambi'],
        ['Credenziali Alloggiati Web', 'Le schede partono dall\'utenza Questura della singola struttura'],
        ['Backup', 'Il titolare può esportare e conservare i propri dati in autonomia'],
      ],
      [35, 65]
    ),
    ...spacer(),
    note('Se un titolare gestisce più strutture con la stessa ragione sociale, queste stanno nella stessa istanza e si scelgono dal selettore in alto. Ragioni sociali diverse richiedono istanze diverse.'),
    pageBreak(),

    // 2. Dati per l'attivazione
    h1('2. DATI DA FORNIRE PER L\'ATTIVAZIONE'),
    p('Per attivare l\'istanza, il titolare invia a Innogea i dati seguenti. L\'attivazione richiede in genere un giorno lavorativo dalla ricezione dei dati completi.'),
    h2('2.1 Dati del titolare e della struttura'),
    makeTable(
      ['Dato', 'Dove trovarlo / note'],
      [
        ['Ragione sociale e forma giuridica', 'Visura camerale (per le persone fisiche: nome e cognome)'],
        ['Partita IVA e codice fiscale', 'Visura o certificato di attribuzione'],
        ['Sede legale e PEC', 'Visura camerale'],
        ['Nome e indirizzo della struttura', 'Come riportati negli annunci online'],
        ['CIN — Codice Identificativo Nazionale', 'Banca dati nazionale strutture ricettive (BDSR) del Ministero del Turismo'],
        ['CIR / codice identificativo regionale', 'Portale turistico della Regione; il nome del codice cambia da regione a regione'],
        ['Tipologia ricettiva', 'Es. casa vacanze, locazione turistica, B&B, affittacamere'],
        ['Numero, nomi e prezzi base delle camere', 'Elenco delle unità da gestire'],
      ],
      [40, 60]
    ),
    ...spacer(),
    h2('2.2 Accessi ai servizi esterni'),
    makeTable(
      ['Servizio', 'Cosa serve'],
      [
        ['Alloggiati Web (Polizia di Stato)', 'Utente, password e chiave Web Service (WSKey) della struttura'],
        ['Booking.com', 'URL iCal di esportazione per ogni camera (Extranet → Tariffe e disponibilità → Sincronizza calendari)'],
        ['Airbnb', 'URL iCal di esportazione per ogni annuncio (Calendario → Disponibilità → Collega calendari)'],
        ['Tassa di soggiorno', 'Tariffa per notte, numero massimo di notti tassabili e categorie di esenti previste dal regolamento del Comune'],
        ['Istruzioni di check-in', 'Testo da inviare agli ospiti: accesso, codici, Wi-Fi, parcheggio, contatti'],
        ['Conti di incasso', 'Elenco dei conti o casse da usare in Prima Nota (contanti, POS, bonifico, altro)'],
      ],
      [35, 65]
    ),
    ...spacer(),
    warn('Credenziali Alloggiati Web e URL iCal sono dati riservati: inviarli solo via canale sicuro concordato con Innogea, mai per email in chiaro insieme alla password.'),
    pageBreak(),

    // 3. Primo accesso
    h1('3. PRIMO ACCESSO'),
    stepBox(1, 'Aprire l\'indirizzo della propria istanza', [
      'L\'indirizzo è comunicato da Innogea all\'attivazione',
      'Usare Google Chrome, Microsoft Edge o Safari aggiornati',
    ]),
    ...spacer(),
    stepBox(2, 'Inserire le credenziali', [
      'Username e password temporanea forniti da Innogea',
      'Cliccare "Accedi"',
    ]),
    ...spacer(),
    stepBox(3, 'Installare l\'app sul telefono (consigliato)', [
      'Da Chrome (Android): menu ⋮ → "Aggiungi a schermata Home"',
      'Da Safari (iPhone): pulsante Condividi → "Aggiungi alla schermata Home"',
      'L\'app si apre come un\'applicazione normale, senza barra del browser',
    ]),
    ...spacer(),
    note('La sessione resta attiva 7 giorni sullo stesso dispositivo. Dopo 7 giorni, o su un nuovo dispositivo, il sistema chiede di nuovo le credenziali.'),
    h2('3.1 Il menu principale'),
    ...await figure('menu.png', 'Il menu principale dell\'applicazione'),
    makeTable(
      ['Voce di menu', 'A cosa serve'],
      [
        ['Calendario', 'Occupazione delle camere giorno per giorno: il punto di partenza di ogni giornata'],
        ['Prenotazioni', 'Elenco completo, inserimento e modifica, invio link e istruzioni agli ospiti'],
        ['Prima Nota', 'Entrate e uscite, con export Excel e PDF'],
        ['Alloggiati', 'Schede ospiti per la Questura e riepilogo della tassa di soggiorno'],
        ['Dashboard', 'Occupazione, ricavi e margini per camera'],
        ['Altro', 'Impostazioni: struttura, camere, prezzi, iCal, utenti, backup'],
      ],
      [25, 75]
    ),
    pageBreak(),

    // 4. Configurazione iniziale
    h1('4. CONFIGURAZIONE INIZIALE DELLA STRUTTURA'),
    p('Al primo accesso si apre la configurazione guidata: 8 passi, circa 15 minuti, con i dati della sezione 2 a portata di mano. I dati si salvano a ogni passo, quindi si può interrompere e riprendere.'),
    ...await figure('wizard.png', 'La configurazione guidata'),
    makeTable(
      ['Passo', 'Cosa si inserisce'],
      [
        ['1. Titolare', 'Ragione sociale, partita IVA, codice fiscale, sede legale, PEC'],
        ['2. Struttura', 'Nome, indirizzo, comune, tipologia ricettiva, CIN e CIR'],
        ['3. Camere', 'Numero di camere, nome e prezzo base di ciascuna'],
        ['4. Canali', 'URL iCal di Booking.com e Airbnb per ogni camera (facoltativo)'],
        ['5. Alloggiati Web', 'Utente, password e chiave Web Service della Questura (facoltativo)'],
        ['6. Regole', 'Notti massime tassabili, tariffa della tassa, costi di pulizia, modalità di incasso'],
        ['7. Check-in', 'Il messaggio con le istruzioni per gli ospiti, con anteprima'],
        ['8. Riepilogo', 'Controllo finale e conferma'],
      ],
      [25, 75]
    ),
    ...spacer(),
    tip('Le credenziali Alloggiati Web si inseriscono direttamente nel passo 5: non è necessario inviarle a Innogea.'),
    p('Tutto si può modificare in seguito dal menu "Altro" o riaprendo la configurazione guidata da Altro → Strutture.'),
    ...await figure('impostazioni.png', 'La pagina Altro → Impostazioni'),
    makeTable(
      ['Scheda in "Altro"', 'Cosa si configura'],
      [
        ['Strutture', 'Anagrafica della struttura, credenziali Alloggiati Web, conti di incasso'],
        ['Camere', 'Numero, nomi, prezzi base e colori delle camere'],
        ['Prezzi per periodo', 'Tariffe per stagione, distinte tra diretto, Booking.com e Airbnb'],
        ['iCal', 'URL in ingresso da Booking.com e Airbnb; link in uscita da dare ai portali'],
        ['App', 'Nome e logo mostrati nell\'applicazione'],
        ['Account', 'Utenti che possono accedere e loro permessi'],
        ['Sistema', 'Backup e ripristino dei dati'],
      ],
      [30, 70]
    ),
    ...spacer(),
    h2('4.1 Collegare Booking.com e Airbnb'),
    stepBox(1, 'Importare i calendari dei portali', [
      'Altro → iCal: incollare, per ogni camera, l\'URL iCal esportato da Booking.com e/o Airbnb',
      'Salvare: da questo momento il pulsante "Sync iCal" importa le prenotazioni',
    ]),
    ...spacer(),
    stepBox(2, 'Esportare il calendario verso i portali', [
      'Nella stessa scheda, copiare il link iCal "in uscita" di ogni camera',
      'Incollarlo su Booking.com e Airbnb: le prenotazioni dirette bloccano le date anche sui portali',
    ]),
    ...spacer(),
    tip('La sincronizzazione automatica gira ogni mattina alle 06:00. Il pulsante "Sync iCal" serve per aggiornare subito dopo una nuova prenotazione.'),
    h2('4.2 Creare gli utenti dei collaboratori'),
    stepBox(3, 'Aggiungere un utente', [
      'Altro → Account → "Aggiungi utente"',
      'Scegliere username e password temporanea da comunicare al collaboratore',
      'Lasciare attivo "Solo calendario" per addetti alle pulizie e personale esterno',
    ]),
    ...spacer(),
    warn('Non condividere le credenziali del titolare. Creare un utente per ogni persona: in caso di fine collaborazione basta eliminare quell\'utente.'),
    pageBreak(),

    // 5. Uso quotidiano
    h1('5. USO QUOTIDIANO: CALENDARIO E PRENOTAZIONI'),
    ...await figure('diag-giornata.png', 'Figura 2 — Le attività ricorrenti di una giornata'),
    h2('5.1 Il Calendario'),
    ...await figure('calendario.png', 'Il Calendario: una riga per camera, una colonna per giorno'),
    bullet('Ogni blocco colorato è una prenotazione; il colore identifica la camera'),
    bullet('Cliccando un giorno si vedono arrivi, partenze e ospiti presenti'),
    bullet('Dal giorno selezionato si registra la tassa di soggiorno incassata e la biancheria usata'),
    bullet('"Sync iCal" importa subito le nuove prenotazioni dei portali'),
    h2('5.2 Inserire una prenotazione diretta'),
    stepBox(1, 'Aprire il modulo', ['Prenotazioni (o Calendario) → "+ Nuova prenotazione"']),
    ...spacer(),
    stepBox(2, 'Compilare i dati', [
      'Camera, nome ospite, date di check-in e check-out',
      'Importo totale e tassa di soggiorno; telefono ed email dell\'ospite',
      'Il sistema segnala se le date si sovrappongono a un\'altra prenotazione',
    ]),
    ...spacer(),
    stepBox(3, 'Salvare', ['La prenotazione appare subito in calendario e, al sync successivo, blocca le date sui portali']),
    ...spacer(),
    tip('Il pulsante microfono permette di dettare la prenotazione, ad esempio: "Camera rossa, dal 15 al 20 maggio, Mario Rossi, 300 euro".'),
    h2('5.3 Comunicare con l\'ospite'),
    ...await figure('prenotazioni.png', 'L\'elenco Prenotazioni con le azioni verso l\'ospite'),
    makeTable(
      ['Azione sulla prenotazione', 'Cosa succede'],
      [
        ['Invia link registrazione documenti', 'L\'ospite riceve via email un link monouso per inserire i dati o fotografare il documento'],
        ['Invia istruzioni check-in', 'Il sistema prepara il messaggio con le istruzioni della struttura, pronto da inviare su WhatsApp'],
        ['Stato check-in', 'Indica se l\'ospite ha già completato la registrazione dei documenti'],
      ],
      [40, 60]
    ),
    pageBreak(),

    // 6. Adempimenti
    h1('6. OSPITI E ADEMPIMENTI'),
    ...await figure('diag-flusso-ospite.png', 'Figura 3 — Il percorso dell\'ospite fino agli adempimenti'),
    h2('6.1 Alloggiati Web (comunicazione alla Questura)'),
    p('La legge impone di comunicare le generalità degli ospiti alla Questura entro 24 ore dall\'arrivo. L\'app prepara le schede e le invia direttamente al portale Alloggiati Web con le credenziali della struttura.'),
    ...await figure('alloggiati.png', 'La sezione Alloggiati con le schede ospiti'),
    stepBox(1, 'Raccogliere i dati', [
      'Automaticamente: l\'ospite compila tramite il link ricevuto',
      'Manualmente: Alloggiati → nuova scheda, oppure scansione del documento con la fotocamera',
    ]),
    ...spacer(),
    stepBox(2, 'Verificare la scheda', [
      'Controllare nome, data e luogo di nascita, cittadinanza e documento',
      'Il sistema evidenzia i campi mancanti o non validi',
    ]),
    ...spacer(),
    stepBox(3, 'Inviare', [
      'Cliccare "Invia al portale": la ricevuta di Alloggiati Web conferma l\'avvenuto invio',
      'In alternativa si può scaricare il file tracciato e caricarlo manualmente sul portale',
    ]),
    ...spacer(),
    warn('La responsabilità della comunicazione resta del titolare. Verificare sempre l\'esito dell\'invio e conservare le ricevute.'),
    h2('6.2 Tassa di soggiorno'),
    bullet('Alloggiati → scheda "Tassa di soggiorno": riepilogo per trimestre di notti, ospiti ed esenti'),
    bullet('Si registra l\'importo effettivamente versato al Comune e si scarica la ricevuta in PDF'),
    bullet('Le regole (tariffa, notti massime, esenzioni) seguono il regolamento del Comune della struttura'),
    ...spacer(),
    note('La comunicazione dei flussi turistici (ISTAT / portale regionale) non è inclusa: continua a farsi sul portale della propria Regione.'),
    pageBreak(),

    // 7. Prima nota e dashboard
    h1('7. PRIMA NOTA, DASHBOARD E DATI PER IL COMMERCIALISTA'),
    h2('7.1 Prima Nota'),
    bullet('Registra entrate e uscite con data, categoria, importo e conto di incasso o pagamento'),
    bullet('Le tasse di soggiorno registrate dal Calendario compaiono qui automaticamente'),
    bullet('Export Excel e stampa PDF per il commercialista'),
    h2('7.2 Dashboard'),
    ...await figure('dashboard.png', 'La Dashboard con occupazione e ricavi'),
    makeTable(
      ['Indicatore', 'Significato'],
      [
        ['Occupazione %', 'Notti occupate ÷ notti disponibili nel periodo'],
        ['Ricavi per camera', 'Totale del periodo e ricavo medio per notte'],
        ['Margine per camera', 'Ricavi meno costi di pulizia e spese attribuite'],
        ['Controllo lavanderia', 'Biancheria registrata rispetto ai cambi previsti'],
      ],
      [30, 70]
    ),
    pageBreak(),

    // 8. Privacy
    h1('8. PRIVACY E SICUREZZA DEI DATI'),
    makeTable(
      ['Ruolo GDPR', 'Chi'],
      [
        ['Titolare del trattamento', 'La ragione sociale che gestisce la struttura'],
        ['Responsabile del trattamento (art. 28)', 'Innogea S.r.L, sulla base dell\'accordo di nomina firmato all\'attivazione'],
        ['Sub-responsabili', 'Fornitori di hosting e database in UE (Vercel, regione Francoforte; Neon Postgres)'],
      ],
      [40, 60]
    ),
    ...spacer(),
    bullet('Accesso protetto da password cifrata e sessione a scadenza'),
    bullet('Database separato per ogni ragione sociale'),
    bullet('Link di registrazione dell\'ospite monouso'),
    bullet('Backup esportabile in qualsiasi momento da Altro → Sistema'),
    ...spacer(),
    tip('Consiglio: eseguire un backup a fine mese e conservarlo in un archivio aziendale.'),
    pageBreak(),

    // 9. Checklist
    h1('9. CHECKLIST DI AVVIO'),
    makeTable(
      ['Verifica', 'Fatto'],
      [
        ['Dati societari, CIN e CIR inviati a Innogea', '☐'],
        ['Accordo di nomina a responsabile del trattamento firmato', '☐'],
        ['Primo accesso eseguito e password cambiata', '☐'],
        ['App installata sul telefono', '☐'],
        ['Camere, prezzi e colori verificati', '☐'],
        ['URL iCal di Booking.com e Airbnb inseriti per ogni camera', '☐'],
        ['Link iCal in uscita caricati sui portali', '☐'],
        ['Primo "Sync iCal" eseguito: prenotazioni future visibili', '☐'],
        ['Credenziali Alloggiati Web verificate con un invio di prova', '☐'],
        ['Regole della tassa di soggiorno verificate', '☐'],
        ['Utenti dei collaboratori creati', '☐'],
        ['Primo backup eseguito e archiviato', '☐'],
      ],
      [80, 20]
    ),
    pageBreak(),

    // 10. FAQ
    h1('10. DOMANDE FREQUENTI'),
    makeTable(
      ['Domanda', 'Risposta'],
      [
        ['Ho due strutture con ragioni sociali diverse: posso usare un solo accesso?', 'No. Ogni ragione sociale ha la propria istanza, con indirizzo e credenziali propri. È la garanzia che dati fiscali e ospiti non si mescolino.'],
        ['Ho due strutture con la stessa ragione sociale', 'Stanno nella stessa istanza: si passa dall\'una all\'altra con il selettore in alto.'],
        ['Una prenotazione di Booking.com non compare', 'Premere "Sync iCal". Se non compare ancora, verificare l\'URL iCal della camera in Altro → iCal.'],
        ['La prenotazione mostra "Ospite Booking.com" senza nome', 'Il feed iCal dei portali spesso non include il nome. Completare i dati dalla prenotazione o tramite il link documenti.'],
        ['L\'invio ad Alloggiati Web dà errore', 'Verificare utente, password e WSKey in Altro → Strutture. La WSKey va rigenerata sul portale se è scaduta.'],
        ['Posso usare l\'app da telefono?', 'Sì. Alcuni grafici della Dashboard e la sincronizzazione con Google Sheets sono disponibili solo da computer.'],
        ['Come esporto i dati per il commercialista?', 'Prima Nota → Export Excel, oppure Dashboard → Export Excel/PDF.'],
      ],
      [40, 60]
    ),
    ...spacer(2),
    h1('SUPPORTO'),
    makeTable(
      ['Contatto', 'Dettaglio'],
      [
        ['Email supporto', 'd.santagati@innogea.com'],
        ['Azienda', 'Innogea S.r.L'],
        ['Indirizzo della propria istanza', 'Comunicato all\'attivazione'],
      ],
      [35, 65]
    ),
    new Paragraph({
      children: [new TextRun({ text: 'Documento v1.0 — 29/09/2026 — Innogea S.r.L', color: GRAY, size: 18, italics: true, font: 'Calibri' })],
      alignment: AlignmentType.CENTER, spacing: { before: 400 },
    }),
  ];

  return new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22, color: '1F2937' } } } },
    sections: [{
      properties: { page: { margin: pageMargins } },
      footers: {
        default: new Footer({ children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'Guida per il titolare — Affitti Brevi   ·   pag. ', size: 16, color: GRAY, font: 'Calibri' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRAY, font: 'Calibri' }),
          ],
        })] }),
      },
      children,
    }],
  });
}

// ─── Generate ────────────────────────────────────────────────────────────────
await renderDiagrams();
const buf = await Packer.toBuffer(await buildGuidaTitolare());
fs.writeFileSync('./GUIDA_TITOLARE_STRUTTURA.docx', buf);
console.log('✅ Generato: GUIDA_TITOLARE_STRUTTURA.docx');
const mancanti = ['menu', 'wizard', 'impostazioni', 'calendario', 'prenotazioni', 'alloggiati', 'dashboard']
  .filter(n => !fs.existsSync(path.join(IMG_DIR, `${n}.png`)));
if (mancanti.length) console.log(`ℹ  Screenshot non ancora presenti (sezioni generate senza immagine): ${mancanti.join(', ')}`);
