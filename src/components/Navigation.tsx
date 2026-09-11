"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/shelf", label: "Shelf", icon: "shelf" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/members", label: "Members", icon: "members" },
];

function NavIcon({ icon, className }: { icon: string; className?: string }) {
  const common = { className, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", strokeWidth: 1.75 };
  switch (icon) {
    case "home":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-8 9 8v9a2 2 0 01-2 2h-4v-6H9v6H5a2 2 0 01-2-2v-9z" />
        </svg>
      );
    case "shelf":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h4v16H4zM10 4h4v16h-4zM16 6l4-1v15l-4 1z" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3m8-3v3M4 9h16M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z" />
        </svg>
      );
    case "members":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1m18 0v-1a4 4 0 00-3-3.87M13 7a3 3 0 11-6 0 3 3 0 016 0zm3-3a3 3 0 010 6" />
        </svg>
      );
    default:
      return null;
  }
}

export default function Navigation() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <nav className="hidden md:flex items-center gap-0.5">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "h-9 px-3.5 rounded-lg font-sans text-sm inline-flex items-center transition-colors",
              isActive(item.href) ? "bg-charcoal/[0.06] text-charcoal font-medium" : "text-warm-brown hover:text-charcoal hover:bg-charcoal/[0.04]"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-cream/90 backdrop-blur-md border-t border-charcoal/[0.06] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around h-16 px-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 rounded-xl transition-colors",
                  active ? "text-mahogany" : "text-warm-brown/70"
                )}
              >
                <NavIcon icon={item.icon} className="w-[22px] h-[22px]" />
                <span className={cn("font-sans text-[10px]", active ? "font-semibold" : "font-medium")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
