// Il portale Alloggiati Web rifiuta il numero documento con trattini, spazi, punti o altri simboli:
// si tengono solo lettere e cifre (accenti tolti), in maiuscolo.
export function pulisciNumeroDocumento(raw: string | null | undefined): string {
  return (raw ?? '').toUpperCase().normalize('NFD').replace(/[^A-Z0-9]/g, '');
}
