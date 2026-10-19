import type { Struttura } from './types';

// Usabile anche lato client: dice se per una camera sono configurati gli invii
// (stesse regole di credenzialiAlloggiati / credenzialiOsservatorio in lib/strutture.ts).
// Senza camera (ospiti senza prenotazione) basta che sia configurata la struttura o una camera qualsiasi.

type Cred = Record<string, string | undefined> | null | undefined;

function configurato(struttura: Cred, camere: Record<number, Cred> | undefined, campi: string[], cameraId?: number | null): boolean {
  const completo = (c: Cred) => !!c && campi.every(k => !!c[k]);
  if (completo(struttura)) return true;
  const perCamera = camere ?? {};
  if (cameraId != null) return completo(perCamera[cameraId]);
  return Object.values(perCamera).some(completo);
}

/** Alloggiati Web (Questura) configurato per la camera */
export function questuraConfigurata(s: Struttura | null | undefined, cameraId?: number | null): boolean {
  if (!s) return false;
  return configurato(s.alloggiati_credentials as unknown as Cred, s.alloggiati_camere as unknown as Record<number, Cred>,
    ['utente', 'password', 'wskey'], cameraId);
}

/** Osservatorio Turistico (Turist@t) configurato per la camera */
export function osservatorioConfigurato(s: Struttura | null | undefined, cameraId?: number | null): boolean {
  if (!s) return false;
  return configurato(s.osservatorio_credentials as unknown as Cred, s.osservatorio_camere as unknown as Record<number, Cred>,
    ['utente', 'password', 'codice_struttura'], cameraId);
}
