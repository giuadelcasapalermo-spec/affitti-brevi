'use client';
import { useStruttura } from './useStruttura';
import { etichetteUnita, type EtichetteUnita } from '@/lib/unita';

/** "Camera/Camere" o "Casa/Case" secondo la struttura attiva (Altro → Strutture) */
export function useEtichette(): EtichetteUnita {
  const { struttura } = useStruttura();
  return etichetteUnita(struttura?.unita_casa);
}
