import { format, parseISO } from 'date-fns';
import type { Ricevuta } from './types';

const euro = (n: number) => `€ ${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const giorno = (d: string) => format(parseISO(d), 'dd/MM/yyyy');

/** Scarica il PDF di una ricevuta (lato browser) */
export async function scaricaRicevutaPdf(r: Ricevuta, modalitaPagamento: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const em = r.emittente;

  // Emittente
  let y = 20;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(em.nome || 'Struttura ricettiva', 20, y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const righeEm = [
    em.indirizzo,
    [em.codice_fiscale && `C.F. ${em.codice_fiscale}`, em.partita_iva && `P.IVA ${em.partita_iva}`].filter(Boolean).join('  ·  '),
    [em.cin && `CIN ${em.cin}`, em.cir && `CIR ${em.cir}`].filter(Boolean).join('  ·  '),
  ].filter(Boolean);
  for (const t of righeEm) { y += 5; doc.text(t, 20, y); }

  // Numero e data
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`RICEVUTA N. ${r.numero}/${r.anno}`, 190, 20, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data: ${giorno(r.data_emissione)}`, 190, 27, { align: 'right' });

  y = Math.max(y, 27) + 8;
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
  const voci: [string, number][] = [[`${r.descrizione}${periodo}${presso ? ` presso ${presso}` : ''}`, r.importo]];
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

  y += 9;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('IMPORTO TOTALE PAGATO', 23, y);
  doc.text(euro(r.importo + r.tassa), 187, y, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  y += 8;
  doc.text(`Mezzo di pagamento: ${r.mezzo_pagamento || modalitaPagamento || 'Contanti'}`, 23, y);

  // Note
  y += 14;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(90);
  const note: string[] = [];
  if (!em.partita_iva) note.push('Operazione esclusa dal campo di applicazione dell\'IVA ai sensi dell\'art. 4 D.P.R. 633/1972.');
  if (r.bollo) note.push('Imposta di bollo da € 2,00 assolta sull\'originale.');
  if (r.tassa > 0) note.push('L\'imposta di soggiorno è riscossa per conto del Comune e non costituisce corrispettivo.');
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

  const nome = r.intestatario.replace(/[^\w-]+/g, '-').replace(/-+/g, '-');
  doc.save(`ricevuta-${r.anno}-${String(r.numero).padStart(3, '0')}_${nome}.pdf`);
}
