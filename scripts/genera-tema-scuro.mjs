// Genera app/tema-scuro.css: modalità scura per tutta l'app senza toccare i componenti.
// Tailwind 4 usa variabili CSS per i colori (bg-white → var(--color-white)): con la classe .dark
// su <html> la scala si inverte (50↔950, 100↔900, … 500 resta, bianco↔quasi nero), così testo e
// sfondo mantengono il contrasto ovunque. La classe .tema-originale riporta i colori normali in
// un'area (es. la barra blu in alto); .tema-scuro dentro di essa torna scura (es. un menu a tendina).
// Solo a schermo: la stampa resta chiara.
// Uso: node scripts/genera-tema-scuro.mjs   (da rilanciare dopo un aggiornamento di Tailwind)
import { readFileSync, writeFileSync } from 'node:fs';

const theme = readFileSync('node_modules/tailwindcss/theme.css', 'utf8');
const colori = new Map();
for (const m of theme.matchAll(/--color-([a-z]+)-(\d+):\s*([^;]+);/g)) {
  if (!colori.has(m[1])) colori.set(m[1], new Map());
  colori.get(m[1]).set(Number(m[2]), m[3].trim());
}
const scuro = [], originale = [];
for (const [famiglia, scala] of colori) {
  for (const [grado, valore] of scala) {
    const opposto = scala.get(1000 - grado) ?? valore;
    scuro.push(`    --color-${famiglia}-${grado}: ${opposto};`);
    originale.push(`    --color-${famiglia}-${grado}: ${valore};`);
  }
}
// Bianco → superficie scura poco più chiara della pagina (gray-50 → gray-950); nero → bianco
scuro.push('    --color-white: oklch(19% 0.02 265);', '    --color-black: #fff;');
originale.push('    --color-white: #fff;', '    --color-black: #000;');

const css = `/* GENERATO da scripts/genera-tema-scuro.mjs: non modificare a mano. */
@media screen {
  html.dark {
    color-scheme: dark;
    --background: oklch(19% 0.02 265);
    --foreground: #ededed;
${scuro.join('\n')}
  }
  html.dark .tema-originale {
    color-scheme: light;
${originale.join('\n')}
  }
  html.dark .tema-originale .tema-scuro {
    color-scheme: dark;
${scuro.join('\n')}
  }
}
`;
writeFileSync('app/tema-scuro.css', css);
console.log(`app/tema-scuro.css: ${scuro.length} colori`);
