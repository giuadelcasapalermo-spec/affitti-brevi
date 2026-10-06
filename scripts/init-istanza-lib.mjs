/**
 * Inizializzazione del database di una NUOVA istanza: tabelle base + primo amministratore.
 * Usata da scripts/init-istanza.mjs (riga di comando) e dall'attivatore grafico.
 * Le altre tabelle e colonne le crea l'app al primo accesso.
 */
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

export class IstanzaNonVuotaError extends Error {}

export async function inizializzaIstanza(databaseUrl, { admin, nomeApp, force = false }) {
  if (!databaseUrl) throw new Error('DATABASE_URL mancante');
  if (!admin) throw new Error('Username amministratore mancante');
  const sql = neon(databaseUrl);
  const host = new URL(databaseUrl).host;

  // Protezione: non toccare un database che contiene già utenti
  if (!force) {
    const [{ n }] = await sql`
      SELECT COUNT(*)::int AS n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'utenti'
    `;
    if (n > 0) {
      const [{ righe }] = await sql`SELECT COUNT(*)::int AS righe FROM utenti`;
      if (righe > 0) throw new IstanzaNonVuotaError(`Il database ${host} contiene già ${righe} utenti: non è un'istanza nuova`);
    }
  }

  // Schema allineato a scripts/migrate-to-db.ts + colonne aggiunte a runtime da lib/*
  await sql`
    CREATE TABLE IF NOT EXISTS prenotazioni (
      id TEXT PRIMARY KEY,
      camera_id INTEGER NOT NULL,
      ospite_nome TEXT NOT NULL DEFAULT '',
      ospite_telefono TEXT NOT NULL DEFAULT '',
      ospite_email TEXT NOT NULL DEFAULT '',
      check_in TEXT NOT NULL,
      check_out TEXT NOT NULL,
      importo_totale REAL NOT NULL DEFAULT 0,
      tassa_soggiorno REAL,
      stato TEXT NOT NULL DEFAULT 'confermata',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      fonte TEXT NOT NULL DEFAULT 'manuale',
      ical_uid TEXT,
      struttura_id TEXT,
      tassa_esenti INT NOT NULL DEFAULT 0,
      tassa_trovata REAL
    )
  `;
  for (const t of ['uscite', 'entrate']) {
    await sql.query(`
      CREATE TABLE IF NOT EXISTS ${t} (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        descrizione TEXT NOT NULL,
        categoria TEXT NOT NULL,
        importo REAL NOT NULL,
        camera_id INTEGER,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        fonte_pagamento TEXT NOT NULL DEFAULT 'Contanti'
      )
    `);
  }
  await sql`
    CREATE TABLE IF NOT EXISTS impostazioni (
      tipo TEXT NOT NULL,
      chiave TEXT NOT NULL,
      valore TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (tipo, chiave)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS utenti (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      salt TEXT NOT NULL,
      hash TEXT NOT NULL,
      solo_calendario BOOLEAN DEFAULT FALSE
    )
  `;

  const config = [
    // Google Sheets disattivato finché il titolare non configura un foglio suo
    ['google_sheets_abilitato', 'false'],
    // Al primo accesso il titolare viene portato alla configurazione guidata (/configurazione)
    ['setup_wizard', 'da_fare'],
    ...(nomeApp ? [['nome_app', nomeApp]] : []),
  ];
  for (const [chiave, valore] of config) {
    await sql`
      INSERT INTO impostazioni (tipo, chiave, valore) VALUES ('config', ${chiave}, ${valore})
      ON CONFLICT (tipo, chiave) DO UPDATE SET valore = EXCLUDED.valore
    `;
  }

  // Primo amministratore — stesso hashing di lib/auth.ts (PBKDF2-SHA256, 600k iterazioni)
  const password = crypto.randomBytes(9).toString('base64url');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 600_000, 32, 'sha256').toString('hex');
  await sql`
    INSERT INTO utenti (id, username, salt, hash, solo_calendario)
    VALUES (${crypto.randomUUID()}, ${admin}, ${salt}, ${hash}, false)
    ON CONFLICT (username) DO UPDATE SET salt = EXCLUDED.salt, hash = EXCLUDED.hash, solo_calendario = false
  `;

  return { host, admin, password };
}
