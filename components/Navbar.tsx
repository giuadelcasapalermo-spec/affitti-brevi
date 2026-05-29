'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Home, CalendarDays, BookOpen, BookMarked, Settings, LogOut, Table2, Building2, ChevronDown, Plus, UserCheck } from 'lucide-react';
import { useSoloCalendario, clearSoloCalendarioCache } from '@/hooks/useSoloCalendario';
import { useNomeApp } from '@/hooks/useNomeApp';
import { useStruttura } from '@/hooks/useStruttura';

const ALL_LINKS: { href: string; label: string; icon: React.ElementType; sheets: boolean; webOnly?: boolean }[] = [
  { href: '/calendario',   label: 'Calendario',  icon: CalendarDays,  sheets: false },
  { href: '/prenotazioni', label: 'Prenotazioni', icon: BookOpen,       sheets: false },
  { href: '/uscite',       label: 'Prima Nota',   icon: BookMarked,    sheets: false },
  { href: '/sheets',       label: 'Sheets',       icon: Table2,        sheets: true  },
  { href: '/dashboard',    label: 'Dashboard',    icon: Home,          sheets: false },
  { href: '/alloggiati',   label: 'Alloggiati',   icon: UserCheck,     sheets: false, webOnly: true },
  { href: '/impostazioni', label: 'Altro',         icon: Settings,      sheets: false },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const soloCalendario = useSoloCalendario();
  const { nome: nomeApp, logo: logoUrl } = useNomeApp();
  const { struttura, strutture, setStruttura } = useStruttura();
  const [sheetsAbilitato, setSheetsAbilitato] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : {})
      .then((d: Record<string, unknown>) => setSheetsAbilitato((d.googleSheetsAbilitato as boolean) ?? false))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  const links = soloCalendario
    ? ALL_LINKS.slice(0, 1)
    : ALL_LINKS.filter(l => !l.sheets || sheetsAbilitato);

  async function logout() {
    clearSoloCalendarioCache();
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  function selezionaStruttura(id: string) {
    setStruttura(id);
    setDropdownOpen(false);
    router.refresh();
  }

  const morePiuUna = strutture.length > 1;

  if (pathname.startsWith('/registrazione')) return null;

  return (
    <>
      {/* Desktop navbar */}
      <nav className="hidden md:block bg-blue-700 text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">

          {/* Logo + nome app + struttura switcher */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-2 hover:opacity-90 transition-opacity focus:outline-none"
            >
              <div className="bg-white rounded-full p-0.5 flex items-center justify-center w-8 h-8 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="Logo" width={28} height={28} className="object-contain" />
              </div>
              <div className="flex flex-col items-start leading-tight">
                <span className="font-bold text-base tracking-tight">{nomeApp}</span>
                {struttura && (
                  <span className="text-[11px] text-blue-200 flex items-center gap-0.5">
                    <Building2 size={9} />
                    {struttura.nome}
                    {morePiuUna && <ChevronDown size={10} className="ml-0.5" />}
                  </span>
                )}
              </div>
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 top-full mt-2 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-50 min-w-[200px]">
                {strutture.map(s => (
                  <button
                    key={s.id}
                    onClick={() => selezionaStruttura(s.id)}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors ${
                      s.id === struttura?.id
                        ? 'font-semibold text-blue-700 bg-blue-50'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Building2 size={14} />
                    {s.nome}
                  </button>
                ))}
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <Link
                    href="/impostazioni"
                    onClick={() => setDropdownOpen(false)}
                    className="w-full text-left px-4 py-2 text-xs text-gray-400 hover:text-blue-600 flex items-center gap-2 transition-colors"
                  >
                    <Plus size={12} />
                    Gestisci strutture
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Nav links */}
          <div className="flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  pathname === href ? 'bg-white/20' : 'hover:bg-white/10'
                }`}
              >
                <Icon size={13} />
                {label}
              </Link>
            ))}
            <button
              onClick={logout}
              title="Esci"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium hover:bg-white/10 transition-colors ml-2 border-l border-white/20 pl-4"
            >
              <LogOut size={15} />
              Esci
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile top bar */}
      <nav className="md:hidden bg-blue-700 text-white shadow-md">
        <div className="px-4 flex items-center justify-between h-12">
          {/* Logo + switcher mobile */}
          <div className="relative" ref={undefined}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-2 focus:outline-none"
            >
              <div className="bg-white rounded-full p-0.5 flex items-center justify-center w-7 h-7 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="Logo" width={24} height={24} className="object-contain" />
              </div>
              <div className="flex flex-col items-start leading-tight">
                <span className="font-bold text-sm tracking-tight">{nomeApp}</span>
                {struttura && (
                  <span className="text-[10px] text-blue-200 flex items-center gap-0.5">
                    <Building2 size={8} />
                    {struttura.nome}
                    {morePiuUna && <ChevronDown size={9} />}
                  </span>
                )}
              </div>
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 top-full mt-2 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-50 min-w-[180px]">
                {strutture.map(s => (
                  <button
                    key={s.id}
                    onClick={() => selezionaStruttura(s.id)}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors ${
                      s.id === struttura?.id
                        ? 'font-semibold text-blue-700 bg-blue-50'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Building2 size={14} />
                    {s.nome}
                  </button>
                ))}
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <Link
                    href="/impostazioni"
                    onClick={() => setDropdownOpen(false)}
                    className="w-full text-left px-4 py-2 text-xs text-gray-400 hover:text-blue-600 flex items-center gap-2"
                  >
                    <Plus size={12} />
                    Gestisci strutture
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Link
              href="/impostazioni"
              className={`p-1.5 rounded hover:bg-white/10 ${pathname === '/impostazioni' ? 'bg-white/20' : ''}`}
              title="Altro"
            >
              <Settings size={18} />
            </Link>
            <button onClick={logout} className="p-1.5 rounded hover:bg-white/10" title="Esci">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-lg">
        {(() => {
          const tabLinks = links.filter(l => l.href !== '/impostazioni' && !l.webOnly);
          return (
            <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${tabLinks.length}, minmax(0, 1fr))` }}>
              {tabLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                    pathname === href ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={22} strokeWidth={pathname === href ? 2.5 : 1.5} />
                  <span className="text-[10px] font-medium">{label}</span>
                </Link>
              ))}
            </div>
          );
        })()}
      </nav>
    </>
  );
}
