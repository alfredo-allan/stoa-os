import type { Metadata, Viewport } from "next";
import { Cinzel, EB_Garamond, Inter, IBM_Plex_Mono, Literata } from "next/font/google";
import "./globals.css";
import { ClientInit } from "@/components/ClientInit";
import { AudioEngine } from "@/lib/player";

const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel", weight: ["400", "500", "600", "700"] });
const garamond = EB_Garamond({ subsets: ["latin", "greek"], variable: "--font-garamond", style: ["normal", "italic"] });
const literata = Literata({ subsets: ["latin", "greek"], variable: "--font-literata", style: ["normal", "italic"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-plex-mono", weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "Stoa OS — Meditações", template: "%s · Stoa OS" },
  description: "Central de estudos e reflexões sobre o estoicismo: Meditações de Marco Aurélio com guia de estudos, podcasts, grifos e notas.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Stoa OS", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#050404",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${cinzel.variable} ${garamond.variable} ${literata.variable} ${inter.variable} ${plex.variable} antialiased`}>
        <ClientInit />
        <AudioEngine />
        {children}
      </body>
    </html>
  );
}
