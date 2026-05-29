import twilio from 'twilio';

function normalizzaTelefono(raw: string): string {
  const s = raw.trim().replace(/\s+/g, '').replace(/-/g, '');
  if (s.startsWith('+')) return s;
  if (s.startsWith('00')) return '+' + s.slice(2);
  // Numero italiano senza prefisso internazionale
  if (s.startsWith('3') && s.length === 10) return '+39' + s;
  return '+39' + s;
}

function client() {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN mancanti');
  return twilio(sid, token);
}

export async function inviaWhatsApp(telefono: string, testo: string): Promise<void> {
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) throw new Error('TWILIO_WHATSAPP_FROM non configurato');
  const to = 'whatsapp:' + normalizzaTelefono(telefono);
  await client().messages.create({ from: 'whatsapp:' + from.replace(/^whatsapp:/, ''), to, body: testo });
}

export async function inviaSMS(telefono: string, testo: string): Promise<void> {
  const from = process.env.TWILIO_SMS_FROM ?? process.env.TWILIO_WHATSAPP_FROM;
  if (!from) throw new Error('TWILIO_SMS_FROM non configurato');
  await client().messages.create({
    from: from.replace(/^whatsapp:/, ''),
    to: normalizzaTelefono(telefono),
    body: testo,
  });
}
