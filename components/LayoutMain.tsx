'use client';

import { usePathname } from 'next/navigation';

export default function LayoutMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith('/registrazione')) return <>{children}</>;
  return <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-6">{children}</main>;
}
