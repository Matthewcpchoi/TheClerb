"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Books, CalendarBlank, UsersThree } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * The four tabs. Icons switch from regular to fill weight when active, and
 * colour goes muted -> ink. 78px tall, floating over content with a blur.
 */
const TABS = [
  { href: "/", label: "Reading", Icon: BookOpen },
  { href: "/shelf", label: "Shelf", Icon: Books },
  { href: "/calendar", label: "Meet", Icon: CalendarBlank },
  { href: "/members", label: "Club", Icon: UsersThree },
];

export default function TabBar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/book") : pathname.startsWith(href);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-[448px] border-t border-tan px-5 pt-[11px]"
      style={{
        height: `calc(78px + env(safe-area-inset-bottom))`,
        background: "rgba(255,245,231,.94)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1",
              active ? "text-ink" : "text-muted"
            )}
          >
            <Icon size={21} weight={active ? "fill" : "regular"} />
            <span className="text-[10px]">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
