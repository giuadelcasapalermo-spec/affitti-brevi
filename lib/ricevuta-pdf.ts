import { format, parseISO } from 'date-fns';
import type { jsPDF as JsPDF } from 'jspdf';
import { Ricevuta, SerieRicevuta, SERIE_RICEVUTA } from './types';

const euro = (n: number) => `€ ${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const giorno = (d: string) => format(parseISO(d), 'dd/MM/yyyy');

const TITOLO: Record<SerieRicevuta, string> = {
  privato: 'RICEVUTA',
  tassa: 'RICEVUTA IMPOSTA DI SOGGIORNO',
};

/** Disegna una ricevuta sulla pagina corrente */
function disegnaRicevuta(doc: JsPDF, r: Ricevuta): void {
  const em = r.emittente;

  // Emittente
  let y = 20;
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(doc.splitTextToSize(em.nome || 'Struttura ricettiva', 95) as string[], 20, y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const righeEm = [
    em.indirizzo,
    [em.codice_fiscale && `C.F. ${em.codice_fiscale}`, em.partita_iva && `P.IVA ${em.partita_iva}`].filter(Boolean).join('  ·  '),
    [em.cin && `CIN ${em.cin}`, em.cir && `CIR ${em.cir}`].filter(Boolean).join('  ·  '),
  ].filter(Boolean);
  for (const t of righeEm) { y += 5; doc.text(t, 20, y); }

  // Numero e data
  doc.setFontSize(r.serie === 'tassa' ? 11 : 13);
  doc.setFont('helvetica', 'bold');
  doc.text(TITOLO[r.serie], 190, 20, { align: 'right' });
  doc.setFontSize(13);
  doc.text(`N. ${r.numero}/${r.anno}`, 190, 27, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data: ${giorno(r.data_emissione)}`, 190, 33, { align: 'right' });

  y = Math.max(y, 33) + 8;
  doc.setDrawColor(200);
  doc.line(20, y, 190, y);

  // Intestatario
  y += 9;
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text('RICEVUTO DA', 20, y);
  doc.setTextColor(0);
  doc.setFontSize(10);
  y += 1;
  const datiCliente: [string, string][] = [
    ['Cognome e nome', r.intestatario],
    ['Codice fiscale', r.codice_fiscale],
    ['Residenza', r.indirizzo],
  ];
  for (const [etichetta, valore] of datiCliente) {
    if (!valore) continue;
    y += 5.5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110);
    doc.text(`${etichetta}:`, 20, y);
    doc.setTextColor(0);
    doc.setFont('helvetica', etichetta === 'Cognome e nome' ? 'bold' : 'normal');
    const righe = doc.splitTextToSize(valore, 135) as string[];
    doc.text(righe, 55, y);
    y += (righe.length - 1) * 5;
  }
  doc.setFont('helvetica', 'normal');

  // Voci
  y += 12;
  doc.setFillColor(243, 244, 246);
  doc.rect(20, y - 5, 170, 8, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('CAUSALE', 23, y);
  doc.text('IMPORTO', 187, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const periodo = r.dal && r.al ? ` dal ${giorno(r.dal)} al ${giorno(r.al)}` : '';
  const presso = [em.struttura, em.struttura_indirizzo].filter(Boolean).join(', ');
  const causale = r.serie === 'tassa'
    ? `Imposta di soggiorno per il soggiorno${periodo}${presso ? ` presso ${presso}` : ''}`
    : `${r.descrizione}${periodo}${presso ? ` presso ${presso}` : ''}`;
  const voci: [string, number][] = [[causale, r.importo]];
  if (r.tassa > 0) voci.push(['Imposta di soggiorno riscossa per conto del Comune', r.tassa]);

  y += 4;
  for (const [testo, importo] of voci) {
    const righe = doc.splitTextToSize(testo, 130) as string[];
    y += 6;
    doc.text(righe, 23, y);
    doc.text(euro(importo), 187, y, { align: 'right' });
    y += (righe.length - 1) * 5 + 2;
    doc.setDrawColor(230);
    doc.line(20, y, 190, y);
  }

  // Dettagli (serie tassa: notti, ospiti, esenti)
  if (r.dettagli?.length) {
    y += 2;
    doc.setFontSize(9);
    for (const [etichetta, valore] of r.dettagli) {
      y += 5;
      doc.setTextColor(110);
      doc.text(`${etichetta}:`, 23, y);
      doc.setTextColor(0);
      doc.text(valore, 90, y);
    }
    doc.setFontSize(10);
    y += 3;
  }

  y += 9;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('IMPORTO TOTALE PAGATO', 23, y);
  doc.text(euro(r.importo + r.tassa), 187, y, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (r.mezzo_pagamento) {
    y += 8;
    doc.text(`Mezzo di pagamento: ${r.mezzo_pagamento}`, 23, y);
  }

  // Note
  y += 14;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(90);
  const note: string[] = [];
  if (r.serie === 'tassa') {
    note.push('Imposta di soggiorno riscossa per conto del Comune ai sensi del regolamento comunale vigente. Non costituisce corrispettivo ed è fuori dal campo di applicazione dell\'IVA.');
  } else {
    if (!em.partita_iva) note.push('Operazione esclusa dal campo di applicazione dell\'IVA ai sensi dell\'art. 4 D.P.R. 633/1972.');
    if (r.bollo) note.push('Imposta di bollo da € 2,00 assolta sull\'originale.');
    if (r.tassa > 0) note.push('L\'imposta di soggiorno è riscossa per conto del Comune e non costituisce corrispettivo.');
  }
  for (const t of note) {
    for (const riga of doc.splitTextToSize(t, 170) as string[]) { doc.text(riga, 20, y); y += 4.5; }
  }
  doc.setTextColor(0);

  if (r.bollo) {
    doc.setDrawColor(160);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.rect(160, y + 6, 30, 30);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Marca da bollo', 175, y + 22, { align: 'center' });
  }

  // Firma
  y += 34;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Firma', 20, y);
  doc.setDrawColor(160);
  doc.line(32, y + 1, 100, y + 1);
}

function nomeFile(r: Ricevuta): string {
  const nome = r.intestatario.replace(/[^\w-]+/g, '-').replace(/-+/g, '-');
  const prefisso = r.serie === 'tassa' ? 'ricevuta-tassa' : 'ricevuta';
  return `${prefisso}-${r.anno}-${String(r.numero).padStart(3, '0')}_${nome}.pdf`;
}

/** Scarica il PDF di una ricevuta (lato browser) */
export async function scaricaRicevutaPdf(r: Ricevuta): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  disegnaRicevuta(doc, r);
  doc.save(nomeFile(r));
}

/** Numeri saltati in ogni anno, tra il primo e l'ultimo numero presenti */
function numeriMancanti(ricevute: Ricevuta[]): string[] {
  const perAnno = new Map<number, Set<number>>();
  for (const r of ricevute) {
    if (!perAnno.has(r.anno)) perAnno.set(r.anno, new Set());
    perAnno.get(r.anno)!.add(r.numero);
  }
  const mancanti: string[] = [];
  for (const [anno, numeri] of perAnno) {
    const lista = [...numeri];
    for (let n = Math.min(...lista); n <= Math.max(...lista); n++) {
      if (!numeri.has(n)) mancanti.push(`${n}/${anno}`);
    }
  }
  return mancanti;
}

/** Disegna il registro (elenco) di una serie, su una o più pagine */
function disegnaRegistro(doc: JsPDF, serie: SerieRicevuta, ricevute: Ricevuta[], dal: string, al: string): void {
  const em = ricevute[0]?.emittente;
  let y = 20;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Registro ricevute – ${SERIE_RICEVUTA[serie]}`, 20, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  y += 7;
  doc.text(`Periodo di emissione: dal ${giorno(dal)} al ${giorno(al)}`, 20, y);
  if (em) {
    y += 5.5;
    doc.text([em.nome, em.codice_fiscale && `C.F. ${em.codice_fiscale}`, em.partita_iva && `P.IVA ${em.partita_iva}`]
      .filter(Boolean).join('  ·  '), 20, y);
  }

  const intestazione = () => {
    doc.setFillColor(243, 244, 246);
    doc.rect(20, y - 5, 170, 8, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('N.', 22, y);
    doc.text('DATA', 40, y);
    doc.text('INTESTATARIO', 62, y);
    doc.text('CODICE FISCALE', 112, y);
    doc.text('IMPORTO', 188, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
  };
  y += 12;
  intestazione();
  for (const r of ricevute) {
    y += 6.5;
    if (y > 280) {
      doc.addPage();
      y = 20;
      intestazione();
      y += 6.5;
    }
    doc.text(`${r.numero}/${r.anno}`, 22, y);
    doc.text(giorno(r.data_emissione), 40, y);
    doc.text((doc.splitTextToSize(r.intestatario, 48) as string[])[0], 62, y);
    doc.text(r.codice_fiscale || '—', 112, y);
    doc.text(euro(r.importo + r.tassa), 188, y, { align: 'right' });
    doc.setDrawColor(235);
    doc.line(20, y + 2, 190, y + 2);
  }
  y += 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`${ricevute.length} ${ricevute.length === 1 ? "ricevuta" : "ricevute"}`, 22, y);
  doc.text(`Totale ${euro(ricevute.reduce((s, r) => s + r.importo + r.tassa, 0))}`, 188, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');

  const mancanti = numeriMancanti(ricevute);
  if (mancanti.length) {
    y += 8;
    doc.setFontSize(9);
    doc.setTextColor(180, 0, 0);
    doc.text(doc.splitTextToSize(`Numeri non presenti nel periodo: ${mancanti.join(', ')}`, 170) as string[], 20, y);
    doc.setTextColor(0);
  }
}

/** Un unico PDF per serie: registro iniziale e poi una ricevuta per pagina */
export async function scaricaRicevuteMassivo(ricevute: Ricevuta[], dal: string, al: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const serieUsate = (['privato', 'tassa'] as SerieRicevuta[]).filter(s => ricevute.some(r => r.serie === s));
  serieUsate.forEach((serie, i) => {
    const elenco = ricevute.filter(r => r.serie === serie).sort((a, b) => a.anno - b.anno || a.numero - b.numero);
    if (i > 0) doc.addPage();
    disegnaRegistro(doc, serie, elenco, dal, al);
    for (const r of elenco) {
      doc.addPage();
      disegnaRicevuta(doc, r);
    }
  });
  const quale = serieUsate.length === 1 ? (serieUsate[0] === 'tassa' ? 'tassa-' : 'privati-') : '';
  doc.save(`ricevute-${quale}${dal}_${al}.pdf`);
}
