import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CSaaS Platform — Cybersecurity & CCTV as a Service",
  description:
    "Enterprise-grade cybersecurity monitoring, CCTV surveillance, and AI-powered threat detection. All in one unified platform.",
  keywords: ["cybersecurity", "CCTV", "SaaS", "SIEM", "threat detection", "surveillance"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
