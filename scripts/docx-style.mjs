import {
  Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, convertInchesToTwip, PageBreak, ImageRun,
  Footer, PageNumber,
} from 'docx';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Stile comune delle guide Word (stessa palette di generate-guides.mjs)

export const IMG_DIR = './scripts/guida-img';

// ─── Palette ────────────────────────────────────────────────────────────────
export const BLUE       = '1E3A5F';
export const BLUE_LIGHT = 'EBF0F7';
export const GRAY       = '6B7280';
export const GREEN      = '166534';
export const GREEN_LIGHT= 'DCFCE7';
export const AMBER      = '92400E';
export const AMBER_LIGHT= 'FEF3C7';
export const RED        = '991B1B';

// ─── Helpers ────────────────────────────────────────────────────────────────
export const pageMargins = {
  top: convertInchesToTwip(1),
  bottom: convertInchesToTwip(1),
  left: convertInchesToTwip(1.2),
  right: convertInchesToTwip(1.2),
};

export const docStyles = { default: { document: { run: { font: 'Calibri', size: 22, color: '1F2937' } } } };

export function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, color: BLUE, size: 30, font: 'Calibri' })],
    spacing: { before: 480, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 4 } },
  });
}
export function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, color: '1D4ED8', size: 24, font: 'Calibri' })],
    spacing: { before: 320, after: 100 },
  });
}
export function p(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: 'Calibri', color: '1F2937', ...opts })],
    spacing: { after: 100 },
  });
}
export function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    children: [new TextRun({ text, size: 22, font: 'Calibri', color: '1F2937' })],
    spacing: { after: 60 },
  });
}
export function code(text) {
  return text.split('\n').map(line => new Paragraph({
    children: [new TextRun({ text: line || ' ', font: 'Courier New', size: 18, color: '1F2937' })],
    spacing: { after: 0, before: 0 },
    indent: { left: convertInchesToTwip(0.2) },
    shading: { type: ShadingType.SOLID, color: 'F3F4F6' },
  }));
}
export function spacer(n = 1) {
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
export const note = t => box('ℹ', t, AMBER_LIGHT, AMBER, true);
export const tip  = t => box('✅', t, GREEN_LIGHT, GREEN, false);
export const warn = t => box('⚠', t, 'FEE2E2', RED, true);
export function pageBreak() { return new Paragraph({ children: [new PageBreak()] }); }

const tableBorders = {
  top:    { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
  left:   { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
  right:  { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
  insideH: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
  insideV: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
};

export function makeTable(header, rows, colWidths) {
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

export function stepBox(num, title, lines) {
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
export async function figure(file, caption) {
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

export async function svgToPng(svg, file) {
  fs.mkdirSync(IMG_DIR, { recursive: true });
  await sharp(Buffer.from(svg), { density: 144 }).png().toFile(path.join(IMG_DIR, file));
}

export const SVG_FONT = 'font-family="Calibri, Segoe UI, Arial, sans-serif"';
export const SVG_ARROW = '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#1E3A5F"/></marker></defs>';

export function cover(title, subtitle, tagline) {
  return [
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 44, color: BLUE, font: 'Calibri' })],
      alignment: AlignmentType.CENTER, spacing: { before: 600, after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: subtitle, size: 30, color: GRAY, font: 'Calibri' })],
      alignment: AlignmentType.CENTER, spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: tagline, size: 22, color: GRAY, font: 'Calibri', italics: true })],
      alignment: AlignmentType.CENTER, spacing: { after: 400 },
    }),
  ];
}

export function versione(text) {
  return new Paragraph({
    children: [new TextRun({ text, color: GRAY, size: 18, italics: true, font: 'Calibri' })],
    alignment: AlignmentType.CENTER, spacing: { before: 400 },
  });
}

export function footer(title) {
  return new Footer({ children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: `${title}   ·   pag. `, size: 16, color: GRAY, font: 'Calibri' }),
      new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRAY, font: 'Calibri' }),
    ],
  })] });
}
