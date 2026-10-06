// Etichette delle unità affittate: "camera" (B&B, affittacamere) o "casa" (più appartamenti con CIN/CIR propri).
// Entrambe femminili: articoli e aggettivi ("la", "tutte le", "nuova") non cambiano.
export interface EtichetteUnita {
  Camera: string;
  Camere: string;
  camera: string;
  camere: string;
  /** Abbreviazione per spazi stretti */
  Cam: string;
}

const CAMERA: EtichetteUnita = { Camera: 'Camera', Camere: 'Camere', camera: 'camera', camere: 'camere', Cam: 'Cam' };
const CASA: EtichetteUnita = { Camera: 'Casa', Camere: 'Case', camera: 'casa', camere: 'case', Cam: 'Casa' };

export function etichetteUnita(casa?: boolean | null): EtichetteUnita {
  return casa ? CASA : CAMERA;
}
