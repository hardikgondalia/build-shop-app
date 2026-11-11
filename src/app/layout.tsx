import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Shop counter",
  description: "Browse the catalogue, record staff payments, and check out a cart.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
       
      </body>
    </html>
  );
}
