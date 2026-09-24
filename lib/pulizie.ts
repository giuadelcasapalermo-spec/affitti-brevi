import { differenceInDays, parseISO } from 'date-fns';
import type { Prenotazione } from './types';

// Costo diretto della collaboratrice: pulizia completa al check-out, cambio per soggiorni lunghi
export const COSTO_PULIZIA_CHECKOUT = 7;
export const COSTO_CAMBIO_STANZA = 4;

export type TipoPulizia = 'checkout' | 'cambio';

// Cambio lenzuola/asciugamani ogni 3 notti trascorse (k), evitando che l'ultimo intervallo
// prima del check-out resti di 1 sola notte: se il soggiorno (N notti) è N%3===1, l'ultimo
// cambio "naturale" (a k = N-1) viene anticipato a k = N-2, così l'ultimo intervallo è di 2 notti.
// Es. 4 notti → cambio a k=2 (invece di k=3); 7 notti → cambio a k=3 e k=5 (invece di k=3 e k=6).
export function isGiornoCambio(k: number, nottiTotali: number): boolean {
  if (k <= 0) return false;
  if (nottiTotali % 3 === 1) {
    if (k === nottiTotali - 1) return false; // rimpiazzato da k = nottiTotali - 2
    if (k === nottiTotali - 2) return true;
  }
  return k % 3 === 0;
}

// Pulizie del giorno (yyyy-MM-dd) per stanza: check-out effettivo (pulizia completa) oppure
// cambio per soggiorni lunghi; se nello stesso giorno ci sono entrambi vale il check-out
export function puliziaGiorno(prenotazioni: Prenotazione[], giorno: string): Map<number, TipoPulizia> {
  const pulizie = new Map<number, TipoPulizia>();
  for (const p of prenotazioni) {
    if (p.stato === 'cancellata') continue;
    if (p.check_out === giorno) { pulizie.set(p.camera_id, 'checkout'); continue; }
    if (p.check_in <= giorno && p.check_out > giorno && !pulizie.has(p.camera_id)) {
      const k = differenceInDays(parseISO(giorno), parseISO(p.check_in));
      const n = differenceInDays(parseISO(p.check_out), parseISO(p.check_in));
      if (isGiornoCambio(k, n)) pulizie.set(p.camera_id, 'cambio');
    }
  }
  return pulizie;
}

export function costoPulizia(tipo: TipoPulizia | undefined): number {
  return tipo === 'checkout' ? COSTO_PULIZIA_CHECKOUT : tipo === 'cambio' ? COSTO_CAMBIO_STANZA : 0;
}

// Quota di ricavo della notte (come nel calendario): importo del soggiorno diviso le notti
export function ricavoNotte(prenotazioni: Prenotazione[], cameraId: number, giorno: string): number {
  const p = prenotazioni.find((x) =>
    x.camera_id === cameraId && x.stato !== 'cancellata' && x.check_in <= giorno && x.check_out > giorno
  );
  if (!p || !(p.importo_totale > 0)) return 0;
  const n = differenceInDays(parseISO(p.check_out), parseISO(p.check_in));
  return n > 0 ? p.importo_totale / n : 0;
}
