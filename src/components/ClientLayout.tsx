"use client";

import MemberProvider, { useMember } from "./MemberProvider";
import Navigation from "./Navigation";
import MemberSelector from "./MemberSelector";
import Link from "next/link";
import { ReactNode } from "react";

function Header() {
  const { currentMember, setCurrentMember } = useMember();

  return (
    <header className="sticky top-0 z-30 bg-cream/85 backdrop-blur-md border-b border-charcoal/[0.06]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="w-7 h-7 rounded-lg bg-mahogany text-cream font-serif text-sm flex items-center justify-center leading-none">
              C
            </span>
            <span className="font-serif text-lg text-charcoal tracking-tight group-hover:text-mahogany transition-colors">
              The Clerb
            </span>
          </Link>
          <Navigation />
        </div>
        <MemberSelector currentMember={currentMember} onSelect={setCurrentMember} />
      </div>
    </header>
  );
}

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <MemberProvider>
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-28 md:pb-12 page-transition">
        {children}
      </main>
    </MemberProvider>
  );
}
