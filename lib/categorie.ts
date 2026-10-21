import type { CategoriaUscita } from './types';

/**
 * Categoria di un'utenza dalla descrizione (e dalle note): la vecchia categoria "Utenze" è stata
 * divisa (21/10/2026) e nei tab mensili del foglio il tipo resta "Utenze" per tutte.
 * undefined se non si riconosce.
 */
export function categoriaUtenza(descrizione: string, note = ''): CategoriaUscita | undefined {
  const t = `${descrizione} ${note}`.toLowerCase();
  if (/\btari\b|rifiuti/.test(t)) return 'TARI';
  if (/condomin/.test(t)) return 'Condominio';
  if (/wind|infostrada|internet|fibra|adsl|\btim\b|vodafone|fastweb|iliad|telefon|wifi|wi-fi/.test(t)) return 'Internet';
  if (/acqua|idric|amap/.test(t)) return 'Acqua';
  if (/\bgas\b|metano/.test(t)) return 'Gas';
  if (/luce|energia|elettric|enel/.test(t)) return 'Luce';
  return undefined;
}

/** Categorie che nei tab mensili del foglio hanno il tipo "Utenze" */
export const CATEGORIE_UTENZE = new Set<string>(['Luce', 'Gas', 'Acqua', 'Internet', 'TARI', 'Condominio']);
