import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Simulador Previsional RPRV - Orientación Independiente Chile",
  description: "Simulador actuarial de Retiro Programado y Renta Vitalicia para orientación independiente en Chile. Estimaciones sin conexión con SCOMP; no constituyen ofertas oficiales",
  keywords: ["Jubilación", "Pensión", "Retiro Programado", "Renta Vitalicia", "AFP", "Chile"],
  authors: [{ name: "Luis Barria" }],
  openGraph: {
    title: "Simulador Previsional RPRV",
    description: "Cálculo y simulación actuarial de pensiones en Chile",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
