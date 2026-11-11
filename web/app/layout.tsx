import type { Metadata } from "next";
import { Fraunces, Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";
import "./v2.css";
import "./app.css";
import { WalletProvider } from "@/lib/wallet";
import AppHeader from "@/components/AppHeader";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", weight: ["500", "700"] });
// Atkinson Hyperlegible was designed for readers with low vision.
const body = Atkinson_Hyperlegible({ subsets: ["latin"], variable: "--font-body", weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Pause: a scam firewall for your family's money",
  description:
    "Risky payments wait. A private AI agent asks the questions scammers coach you to lie about. Your family gets a say. Built on NEAR.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <WalletProvider>
          <AppHeader />
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
