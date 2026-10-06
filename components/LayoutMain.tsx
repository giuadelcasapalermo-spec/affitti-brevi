'use client';

import { usePathname } from 'next/navigation';
import AvvisiAutomazioni from './AvvisiAutomazioni';

export default function LayoutMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith('/registrazione')) return <>{children}</>;
  return (
    <main className="max-w-5xl mx-auto px-4 py-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6">
      {pathname !== '/login' && <AvvisiAutomazioni />}
      {children}
    </main>
  );
}
