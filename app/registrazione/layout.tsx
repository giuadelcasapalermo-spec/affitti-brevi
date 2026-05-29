import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Registrazione Check-in',
  description: 'Registra i tuoi dati per il check-in',
  openGraph: {
    title: 'Registrazione Check-in',
    description: 'Registra i tuoi dati d\'identità per velocizzare il check-in',
    siteName: 'Check-in Online',
  },
};

export default function RegistrazioneLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
