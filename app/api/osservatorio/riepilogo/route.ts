import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import sql from '@/lib/postgres';
import { getStrutturaAttiva } from '@/lib/strutture';
import { leggiPrenotazioni } from '@/lib/db';
import { ensureAlloggiatiTable, rowToAlloggiato } from '@/lib/alloggiati-db';
import type { Alloggiato, Prenotazione } from '@/lib/types';

export type StatoTuristat = 'completo' | 'solo_arrivo' | 'da_inviare' | 'parziale' | 'senza_schede';

export interface SoggiornoTuristat {
  chiave: string;
  prenotazione_id: string | null;
  ospite: string;
  camera_id: number | null;
  fonte: Prenotazione['fonte'] | null;
  check_in: string;
  check_out: string;
  ospiti: number;
  arrivi_inviati: number;
  partenze_inviate: number;
  ultimo_invio: string | null;
  stato: StatoTuristat;
}

const isoData = (v: string) => {
  const s = (v ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
};
const piuGiorni = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * GET ?anno=2026&mese=9 — riepilogo degli invii all'Osservatorio Turistico (Turist@t) per gli arrivi del mese:
 * un soggiorno per prenotazione, con quanti ospiti hanno arrivo e partenza comunicati, più le prenotazioni
 * del mese senza schede ospite (che quindi non possono essere inviate) e lo stato delle chiusure giornaliere.
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const s = await getStrutturaAttiva(cookieStore.get('struttura_id')?.value);
  const anno = Number(req.nextUrl.searchParams.get('anno')) || new Date().getFullYear();
  const mese = Number(req.nextUrl.searchParams.get('mese')) || new Date().getMonth() + 1;
  const dal = `${anno}-${String(mese).padStart(2, '0')}-01`;
  const al = new Date(Date.UTC(anno, mese, 0)).toISOString().slice(0, 10);

  await ensureAlloggiatiTable();
  // Le date di arrivo possono essere salvate anche come GG/MM/AAAA: si filtra dopo la normalizzazione
  const righe = await sql`SELECT * FROM alloggiati WHERE struttura_id = ${s.id}`;
  const alloggiati: Alloggiato[] = righe.map(rowToAlloggiato).filter(a => {
    const d = isoData(a.data_arrivo);
    return d >= dal && d <= al;
  });
  const prenotazioni = await leggiPrenotazioni(s.id);
  const perId = new Map(prenotazioni.map(p => [p.id, p]));

  const gruppi = new Map<string, { p: Prenotazione | null; ospiti: Alloggiato[] }>();
  for (const a of alloggiati) {
    const p = a.prenotazione_id ? perId.get(a.prenotazione_id) ?? null : null;
    if (p?.stato === 'cancellata') continue;
    const chiave = p ? p.id : `ospite-${a.id}`;
    const g = gruppi.get(chiave) ?? { p, ospiti: [] };
    g.ospiti.push(a);
    gruppi.set(chiave, g);
  }

  const soggiorni: SoggiornoTuristat[] = [...gruppi].map(([chiave, { p, ospiti }]) => {
    const arrivi = ospiti.filter(a => a.osservatorio_inviato_at).length;
    const partenze = ospiti.filter(a => a.osservatorio_checkout_at).length;
    const date = ospiti.flatMap(a => [a.osservatorio_inviato_at, a.osservatorio_checkout_at]).filter(Boolean) as string[];
    const primo = ospiti[0];
    const check_in = p?.check_in ?? isoData(primo.data_arrivo);
    const check_out = p?.check_out ?? piuGiorni(isoData(primo.data_arrivo), Math.max(1, primo.permanenza));
    const stato: StatoTuristat = partenze === ospiti.length ? 'completo'
      : arrivi === ospiti.length ? 'solo_arrivo'
      : arrivi === 0 ? 'da_inviare' : 'parziale';
    return {
      chiave, prenotazione_id: p?.id ?? null,
      ospite: p?.ospite_nome || ospiti.map(a => `${a.nome} ${a.cognome}`).join(', '),
      camera_id: p?.camera_id ?? null, fonte: p?.fonte ?? null,
      check_in, check_out, ospiti: ospiti.length,
      arrivi_inviati: arrivi, partenze_inviate: partenze,
      ultimo_invio: date.sort().pop() ?? null, stato,
    };
  });

  // Prenotazioni con arrivo nel mese senza nessuna scheda ospite: non comunicabili
  for (const p of prenotazioni) {
    if (p.stato === 'cancellata' || p.check_in < dal || p.check_in > al || gruppi.has(p.id)) continue;
    soggiorni.push({
      chiave: p.id, prenotazione_id: p.id, ospite: p.ospite_nome, camera_id: p.camera_id, fonte: p.fonte,
      check_in: p.check_in, check_out: p.check_out, ospiti: 0, arrivi_inviati: 0, partenze_inviate: 0,
      ultimo_invio: null, stato: 'senza_schede',
    });
  }
  soggiorni.sort((a, b) => a.check_in.localeCompare(b.check_in) || a.ospite.localeCompare(b.ospite));

  const codici = [s.osservatorio_credentials, ...Object.values(s.osservatorio_camere)]
    .map(c => c?.codice_struttura).filter((c): c is string => !!c);
  const chiusure = codici.length
    ? await sql`SELECT chiave, valore FROM impostazioni WHERE tipo = 'osservatorio_chiusura' AND chiave = ANY(${[...new Set(codici)]})`
    : [];

  return NextResponse.json({
    dal, al, soggiorni,
    chiusure: [...new Set(codici)].map(codice => ({ codice, ultima: (chiusure.find(r => r.chiave === codice)?.valore as string) ?? null })),
    automatico: { attivo: s.automazioni.osservatorio, dal: s.automazioni.osservatorio_dal ?? '' },
    configurato: codici.length > 0,
  });
}
