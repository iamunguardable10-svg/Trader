import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Dashboard — Paper Trading",
  description: "News-to-signal algorithm dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[#08080a] text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
