import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import LayoutMain from "@/components/LayoutMain";
import RegisterSW from "@/components/RegisterSW";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Affitti Brevi",
  description: "Gestione affitti brevi",
  icons: {
    icon: [
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [
      { url: '/icon-192.png', sizes: '192x192' },
    ],
    shortcut: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Affitti Brevi",
  },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  // iOS: niente zoom automatico quando si tocca un campo con testo < 16px (lo zoom con due dita resta)
  maximumScale: 1,
  // Contenuto fino ai bordi (notch, indicatore Home): i margini li danno le env(safe-area-inset-*)
  viewportFit: "cover",
};

// Tema scuro applicato prima del primo disegno (niente lampo bianco): scelta salvata,
// altrimenti l'impostazione del dispositivo. Il pulsante è components/TemaToggle.tsx.
// Le pagine degli ospiti (/registrazione) restano sempre chiare: lì il pulsante non c'è.
const scriptTema = `try{if(location.pathname.indexOf('/registrazione')!==0){var t=localStorage.getItem('tema');if(t==='scuro'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className={`${geist.className} bg-white min-h-screen`}>
        <RegisterSW />
        <Navbar />
        <LayoutMain>{children}</LayoutMain>
      </body>
    </html>
  );
}
