import type { Metadata } from "next";
import { Fraunces, Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import "./v2.css";
import "./app.css";
import "./pause.css";
import { WalletProvider } from "@/lib/wallet";
import AppHeader from "@/components/AppHeader";

const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif", style: ["normal", "italic"] });
const mono = Roboto_Mono({ subsets: ["latin"], variable: "--font-mono" });

const title = "Pause: a scam firewall for your family's money";
const description =
  "Risky payments wait. A private AI asks the questions scammers coach people to lie about, and family can step in. Built on NEAR.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: title, template: "%s · Pause" },
  description,
  openGraph: { title, description, type: "website", siteName: "Pause" },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${serif.variable} ${mono.variable}`}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <WalletProvider>
          <AppHeader />
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
