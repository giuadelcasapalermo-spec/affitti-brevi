export async function inviaEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Credenziali Google non configurate');
  }

  // Ottieni access token fresco
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const tokenData = await tokenRes.json() as { access_token?: string; error?: string; error_description?: string; scope?: string };
  if (!tokenData.access_token) {
    throw new Error(`Errore token: ${tokenData.error} - ${tokenData.error_description}`);
  }

  // Controlla scope nel token
  if (tokenData.scope && !tokenData.scope.includes('gmail.send') && !tokenData.scope.includes('mail.google.com')) {
    throw new Error(`Scope insufficienti. Scope ricevuti: ${tokenData.scope}`);
  }

  // Costruisci email RFC 2822
  const rawEmail = [
    `From: me`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    opts.html,
  ].join('\r\n');

  const base64url = Buffer.from(rawEmail)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Invia via Gmail API
  const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64url }),
  });

  if (!sendRes.ok) {
    const err = await sendRes.json() as { error?: { message?: string; status?: string } };
    throw new Error(`Gmail API: ${err.error?.status} - ${err.error?.message}`);
  }
}
