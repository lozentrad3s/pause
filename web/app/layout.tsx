import type { Metadata } from "next";
import { Inter, Instrument_Serif, Roboto_Mono } from "next/font/google";
import "./globals.css";
import "./v2.css";
import "./app.css";
import { WalletProvider } from "@/lib/wallet";
import AppHeader from "@/components/AppHeader";

const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const serif = Instrument_Serif({ subsets: ["latin"], variable: "--font-serif", weight: "400", style: ["normal", "italic"] });
const mono = Roboto_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Pause: a scam firewall for your family's money",
  description:
    "Risky payments wait. A private AI agent asks the questions scammers coach you to lie about. Your family gets a say. Built on NEAR.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${serif.variable} ${mono.variable}`}>
      <body>
        <WalletProvider>
          <AppHeader />
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
