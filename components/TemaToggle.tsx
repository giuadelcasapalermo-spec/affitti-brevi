'use client';
/**
 * Tema chiaro / scuro (come nel gestionale odontoiatrico). La scelta resta nel browser
 * (localStorage 'tema'); senza scelta segue l'impostazione del telefono o del computer.
 * La classe .dark su <html> la mette già lo script in app/layout.tsx prima della prima visualizzazione.
 */
import { Moon, Sun } from 'lucide-react';

export default function TemaToggle({ className = '', size = 15, conTesto = false }: { className?: string; size?: number; conTesto?: boolean }) {
  function cambia() {
    const scuro = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('tema', scuro ? 'scuro' : 'chiaro'); } catch { /* navigazione privata */ }
  }
  return (
    <button type="button" onClick={cambia} aria-label="Tema chiaro o scuro" title="Tema chiaro o scuro" className={className}>
      <Sun size={size} className="hidden dark:block" />
      <Moon size={size} className="dark:hidden" />
      {conTesto && <><span className="hidden dark:inline">Chiaro</span><span className="dark:hidden">Scuro</span></>}
    </button>
  );
}
