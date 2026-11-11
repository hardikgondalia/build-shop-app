"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavBar() {
  const pathname = usePathname();

  const links = [
    { href: "/shop", label: "Catalogue" },
    { href: "/desk", label: "Staff desk" },
    { href: "/checkout", label: "Checkout" },
  ];

  const isActive = (href: string) => {
    if (href === "/shop") {
      return pathname === "/shop" || pathname.startsWith("/shop/");
    }
    return pathname === href;
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[#eae4da] bg-[#faf8f5]/90 backdrop-blur-md">
      <nav aria-label="Main navigation" className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-3.5">
        <Link
          href="/shop"
          className="flex items-center gap-2.5 font-bold tracking-tight text-[#2c1a12] transition-colors hover:text-[#b45309]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2c1a12] text-sm font-semibold text-[#faf8f5] shadow-xs">
            SC
          </span>
          <span className="text-lg">Shop counter</span>
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {links.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-[#2c1a12] text-white shadow-xs"
                    : "text-[#6e655d] hover:bg-[#ede6dc] hover:text-[#1f1b18]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

