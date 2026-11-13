import type { Metadata } from "next";
import { Fraunces, Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import "./v2.css";
import "./app.css";
import "./groups.css";
import "./landing.css";
import "./pause.css";
import "./brand.css";
import { LangProvider } from "@/lib/lang";
import { WalletProvider } from "@/lib/wallet";
import AppHeader from "@/components/AppHeader";
import ChatWidget from "@/components/ChatWidget";
import SiteFooter from "@/components/SiteFooter";

const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif", style: ["normal", "italic"] });
const mono = Roboto_Mono({ subsets: ["latin"], variable: "--font-mono" });

const title = "Pause AI: a scam firewall for your family's money";
const description =
  "Risky payments wait. A private AI asks the questions scammers coach people to lie about, and family can step in. Built on NEAR.";

// On Vercel the production address is known without any setting.
const site =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: title, template: "%s · Pause AI" },
  icons: { icon: "/img/logo-mark.png" },
  description,
  openGraph: { title, description, type: "website", siteName: "Pause AI" },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${serif.variable} ${mono.variable}`}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <LangProvider>
          <WalletProvider>
            <AppHeader />
            {children}
          <SiteFooter />
          <ChatWidget />
          </WalletProvider>
        </LangProvider>
      </body>
    </html>
  );
}
