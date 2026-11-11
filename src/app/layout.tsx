import type { Metadata } from "next";
import { NavBar } from "@/components/nav-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shop counter",
  description: "Browse the catalogue, record staff payments, and check out a cart.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <NavBar />
        <main className="mx-auto max-w-5xl flex-1 w-full px-6 py-8">{children}</main>
        <footer className="border-t border-[#eae4da] bg-[#faf8f5] py-6 text-center text-xs text-[#6e655d]">
          <div className="mx-auto max-w-5xl px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Shop counter — In-memory Next.js App Router store</span>
            <span className="font-mono text-[11px] text-[#9c9388]">Node.js process state</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
