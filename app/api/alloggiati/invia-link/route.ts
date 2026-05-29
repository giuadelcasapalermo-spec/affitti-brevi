import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStrutturaAttiva } from '@/lib/strutture';
import { leggiPrenotazioni } from '@/lib/db';
import { creaLink } from '@/lib/link-alloggiati';
import { inviaEmail } from '@/lib/gmail-send';

import { differenceInDays, parseISO } from 'date-fns';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prenotazioneId = body.prenotazione_id as string | undefined;
    const emailOverride  = body.email_override  as string | undefined;
    const canale         = (body.canale as string | undefined) ?? 'email';

    if (!prenotazioneId) {
      return NextResponse.json({ errore: 'prenotazione_id mancante' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const strutturaId = cookieStore.get('struttura_id')?.value;
    const struttura   = await getStrutturaAttiva(strutturaId);

    const prenotazioni = await leggiPrenotazioni(struttura.id);
    const pren = prenotazioni.find(p => p.id === prenotazioneId);
    if (!pren) {
      return NextResponse.json({ errore: 'Prenotazione non trovata' }, { status: 404 });
    }

    const permanenza = pren.check_out && pren.check_in
      ? Math.max(1, differenceInDays(parseISO(pren.check_out), parseISO(pren.check_in)))
      : 1;

    // Richiede email solo per canale email
    const emailDestinatario = pren.ospite_email || emailOverride;
    if (canale === 'email' && !emailDestinatario) {
      return NextResponse.json({ errore: 'Email ospite mancante' }, { status: 400 });
    }

    const token = await creaLink({
      prenotazioneId: pren.id,
      strutturaId: struttura.id,
      emailOspite: emailDestinatario ?? '',
      nomeOspite: pren.ospite_nome,
      dataArrivo: pren.check_in,
      permanenza,
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://affittibrevi.vercel.app';
    const url = `${baseUrl}/registrazione/${token}`;

    // canale === 'whatsapp_link': crea solo il token, il frontend apre wa.me
    if (canale === 'whatsapp_link') {
      const dataIT = pren.check_in.split('-').reverse().join('/');
      const testo = `Buongiorno ${pren.ospite_nome},\nLe scriviamo da ${struttura.nome}.\nPer velocizzare il check-in del ${dataIT} La invitiamo a registrare in anticipo i suoi dati d'identità cliccando qui:\n${url}\n\nPuò importare i dati inquadrando direttamente il documento con la fotocamera, senza bisogno di trascriverli.\nUna volta ricevuti i documenti, Le invieremo le istruzioni per il check-in.\n\n---\n\nGood morning ${pren.ospite_nome},\nWe are writing from ${struttura.nome}.\nTo speed up your check-in on ${dataIT}, please register your identity details in advance here:\n${url}\n\nYou can import your data by scanning your document with the camera — no need to type anything manually.\nOnce we receive your documents, we will send you the check-in instructions.`;
      return NextResponse.json({ ok: true, token, url, testo });
    }

    // canale === 'email'
    const html = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
  <h2 style="color:#1d4ed8;margin-bottom:4px">Registrazione check-in / Check-in Registration</h2>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px">

  <p>Gentile <strong>${pren.ospite_nome}</strong>,</p>
  <p>Per il tuo check-in del <strong>${pren.check_in}</strong> ti chiediamo di registrare i tuoi dati d'identità cliccando sul bottone qui sotto. Puoi farlo fotografando il tuo documento — i dati verranno compilati automaticamente.</p>
  <p>Se siete più ospiti, potrai aggiungere i dati di tutti dopo aver registrato il primo.</p>

  <a href="${url}" style="display:inline-block;background:#1d4ed8;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin:20px 0;font-size:15px">
    Registra i tuoi dati / Register your details
  </a>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 20px">

  <p style="color:#4b5563">Dear <strong>${pren.ospite_nome}</strong>,</p>
  <p style="color:#4b5563">For your check-in on <strong>${pren.check_in}</strong>, please register your identity details by clicking the button above. You can do this by photographing your document — the information will be filled in automatically.</p>
  <p style="color:#4b5563">If there are multiple guests, you will be able to add everyone's details after registering the first person.</p>

  <p style="color:#9ca3af;font-size:12px;margin-top:24px">Il link rimane attivo fino al check-in. / The link remains active until check-in.</p>
</div>`;

    await inviaEmail({
      to: emailDestinatario!,
      subject: `Registrazione check-in del ${pren.check_in}`,
      html,
    });

    return NextResponse.json({ ok: true, token });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[invia-link]', msg);
    return NextResponse.json({ errore: msg }, { status: 500 });
  }
}
