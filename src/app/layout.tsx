import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chord Analyzer",
  description: "Midi detector and Chord analyzer",
  icons: {
    icon: [
      { url: "/128.png", sizes: "128x128" },
      { url: "/256.png", sizes: "256x256" },
      { url: "/512.png", sizes: "512x512" },
    ],
    apple: [
      { url: "/512.png", sizes: "512x512" },
    ],
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
