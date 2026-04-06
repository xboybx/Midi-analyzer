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
      { url: "/126.png", sizes: "126x126" },
      { url: "/168.png", sizes: "168x168" },
      { url: "/512.png", sizes: "512x512" },
    ],
    apple: [
      { url: "/512.png", sizes: "512x512" },
    ],
  },
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
