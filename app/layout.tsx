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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className={`${geist.className} bg-white min-h-screen`}>
        <RegisterSW />
        <Navbar />
        <LayoutMain>{children}</LayoutMain>
      </body>
    </html>
  );
}
