/** Converte 'yyyy-MM-dd' → 'dd/MM/yyyy' */
export function fData(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Numero per wa.me: solo cifre con prefisso internazionale (numeri italiani senza prefisso → 39) */
export function numeroWhatsApp(telefono: string): string {
  const num = telefono.trim().replace(/[\s\-().]/g, '');
  return num.startsWith('+') ? num.slice(1)
       : num.startsWith('00') ? num.slice(2)
       : num.startsWith('3') && num.length === 10 ? '39' + num
       : num;
}
