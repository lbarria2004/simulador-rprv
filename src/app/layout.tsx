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
  title: "Simulador Previsional RPRV - Asesoría SCOMP Chile",
  description: "Simulador actuarial de Retiro Programado y Renta Vitalicia conforme a normativa de la CMF y Superintendencia de Pensiones de Chile",
  keywords: ["SCOMP", "Jubilación", "Pensión", "Retiro Programado", "Renta Vitalicia", "AFP", "Chile"],
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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
