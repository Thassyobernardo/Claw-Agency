import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import ConditionalNavbar from "@/components/ConditionalNavbar";
import ConditionalFooter from "@/components/ConditionalFooter";
import SmoothScroll from "@/components/SmoothScroll";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "EcoLink Australia | Automated Carbon Reporting for Australian SMEs",
  description:
    "EcoLink reads your Xero or MYOB transactions and automatically generates compliant AASB S1/S2 carbon reports. Meet your Scope 3 obligations without the spreadsheets.",
  keywords: [
    "carbon accounting",
    "AASB S2",
    "Scope 3 reporting",
    "ESG compliance",
    "Australian SME",
    "Xero carbon",
    "NGA emission factors",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-AU"
      className={`${jakarta.variable} scroll-smooth antialiased`}
    >
      <body className="bg-aw-white text-aw-slate font-jakarta selection:bg-aw-green-light">
        <SmoothScroll>
          <ConditionalNavbar />
          {children}
          <ConditionalFooter />
        </SmoothScroll>
      </body>
    </html>
  );
}
