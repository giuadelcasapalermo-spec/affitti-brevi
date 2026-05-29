import { google } from 'googleapis';
import http from 'http';
import { exec } from 'child_process';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI  = 'http://localhost:4242/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent',
});

console.log('\nApertura browser per autorizzazione Google...\n');
exec(`start "" "${authUrl}"`);

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith('/callback')) return;

  const parsed = new URL(req.url, 'http://localhost:4242');
  const code = parsed.searchParams.get('code');
  const error = parsed.searchParams.get('error');
  if (!code) {
    const msg = error ? `Errore Google: ${error}` : 'Nessun codice ricevuto. URL: ' + req.url;
    console.error('\n✗', msg);
    res.end(`<h2>Errore</h2><pre>${msg}</pre>`);
    return;
  }

  res.end('<h2>Autorizzato! Torna al terminale.</h2>');
  server.close();

  const { tokens } = await oauth2.getToken(code);

  console.log('\n✓ Token ottenuto!\n');
  console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
});

server.listen(4242, () => {
  console.log('In attesa su http://localhost:4242/callback ...\n');
});
