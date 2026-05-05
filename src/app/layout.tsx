import type { Metadata, Viewport } from "next";
import {
  Inter,
  Space_Grotesk,
  DM_Sans,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ImpactGlobe — Real-time Geopolitical Risk Monitor",
  description:
    "Track global news events and their forex impact in real time. Interactive 3D globe with live environmental data, powered by AI. 100% free.",
  keywords: [
    "geopolitical risk",
    "forex impact",
    "global events",
    "3D globe",
    "real-time news",
    "environmental data",
    "air quality",
    "earthquakes",
    "wildfires",
    "market intelligence",
  ],
  authors: [{ name: "ImpactGlobe" }],
  openGraph: {
    title: "ImpactGlobe — Real-time Geopolitical Risk Monitor",
    description:
      "Track global news events and their forex impact in real time on an interactive 3D globe.",
    type: "website",
    locale: "en_US",
    siteName: "ImpactGlobe",
  },
  twitter: {
    card: "summary_large_image",
    title: "ImpactGlobe — Real-time Geopolitical Risk Monitor",
    description:
      "Track global news events and their forex impact in real time.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body
        className="h-full overflow-hidden"
        style={{ background: "#050a14", color: "#f1f0e8", margin: 0 }}
      >
        {children}
      </body>
    </html>
  );
}
