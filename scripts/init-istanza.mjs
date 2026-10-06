/**
 * Inizializza il database Neon di una NUOVA istanza (una per ragione sociale).
 * Crea le tabelle base e il primo utente amministratore. Non importa dati.
 * Per l'attivazione completa in modalità grafica usare l'attivatore (affitti-brevi-attivatore).
 *
 * Uso:
 *   vercel env pull .env.nuova-istanza --environment=production   (dal progetto Vercel della nuova istanza)
 *   node --env-file=.env.nuova-istanza scripts/init-istanza.mjs --admin mario.rossi --nome-app "Casa Rossi"
 *
 * La password dell'amministratore viene generata e stampata una sola volta.
 */
import { inizializzaIstanza, IstanzaNonVuotaError } from './init-istanza-lib.mjs';

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };

try {
  const r = await inizializzaIstanza(process.env.DATABASE_URL, {
    admin: arg('admin'),
    nomeApp: arg('nome-app'),
    force: args.includes('--force'),
  });
  console.log(`Database: ${r.host}`);
  console.log('\n✅ Istanza inizializzata.');
  console.log(`   Utente amministratore: ${r.admin}`);
  console.log(`   Password temporanea:   ${r.password}`);
  console.log('   Comunicarla al titolare su un canale separato e farla cambiare al primo accesso.');
} catch (err) {
  console.error(err instanceof IstanzaNonVuotaError ? `${err.message}. Interrompo (usa --force solo se sai cosa fai).` : err.message);
  process.exit(1);
}
