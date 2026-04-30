"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/",            label: "Dashboard", icon: "⊞" },
  { href: "/signals",     label: "Signals",   icon: "⚡" },
  { href: "/watchlist",   label: "Watchlist", icon: "★"  },
  { href: "/backtest",    label: "Backtest",  icon: "⏱"  },
  { href: "/debug",       label: "Tester",    icon: "🔬" },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950 md:hidden">
      <div className="flex">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-center transition-colors ${
                active ? "text-emerald-400" : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              <span className="text-base leading-none">{icon}</span>
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
