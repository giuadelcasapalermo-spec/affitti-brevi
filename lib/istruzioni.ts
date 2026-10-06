// Messaggio di check-in inviato all'ospite: modello per struttura con segnaposto

export const SEGNAPOSTO_ISTRUZIONI: Record<string, string> = {
  '{ospite}': 'Nome dell\'ospite',
  '{camera}': 'Numero della camera',
  '{tassa}': 'Importo della tassa di soggiorno',
  '{indirizzo}': 'Indirizzo della struttura',
  '{struttura}': 'Nome della struttura',
  '{cin}': 'CIN (della camera se ne ha uno proprio, altrimenti della struttura)',
  '{cir}': 'Codice regionale CIR (della camera o della struttura)',
};

// Proposto dal wizard come punto di partenza: il titolare completa le parti tra [ ]
export const MODELLO_ISTRUZIONI_BASE = `Buongiorno {ospite}, benvenuti!

Ecco le informazioni utili per il vostro soggiorno presso {struttura}.

Check-in: la camera è disponibile dalle ore [15:00]. L'indirizzo è {indirizzo}. [Come entrare: citofono, codici, chiavi]. La vostra camera è la n. {camera}.

Check-out: la camera va liberata entro le ore [11:00]. [Dove lasciare le chiavi].

Tassa di soggiorno: {tassa}, [modalità di pagamento].

Wi-Fi: rete [nome rete], password [password].

Per qualsiasi necessità siamo a vostra disposizione: [telefono].

Buon soggiorno!`;

export interface VariabiliIstruzioni {
  ospite: string;
  camera: number | string;
  tassa: string;
  indirizzo: string;
  struttura: string;
  cin?: string;
  cir?: string;
}

export function componiIstruzioni(modello: string, v: VariabiliIstruzioni): string {
  return modello
    .replaceAll('{ospite}', v.ospite)
    .replaceAll('{camera}', String(v.camera))
    .replaceAll('{tassa}', v.tassa)
    .replaceAll('{indirizzo}', v.indirizzo)
    .replaceAll('{struttura}', v.struttura)
    .replaceAll('{cin}', v.cin ?? '')
    .replaceAll('{cir}', v.cir ?? '');
}
