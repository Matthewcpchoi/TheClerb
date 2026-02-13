"use client";

import MemberProvider, { useMember } from "./MemberProvider";
import Navigation from "./Navigation";
import MemberSelector from "./MemberSelector";
import Link from "next/link";
import { ReactNode } from "react";

function Header() {
  const { currentMember, setCurrentMember } = useMember();

  return (
    <header className="sticky top-0 z-30 bg-cream/90 backdrop-blur-sm border-b border-cream-dark">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <h1 className="font-serif text-2xl text-mahogany tracking-wide">
              The Clerb
            </h1>
          </Link>
          <Navigation />
        </div>

        <MemberSelector
          currentMember={currentMember}
          onSelect={setCurrentMember}
        />
      </div>
    </header>
  );
}

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <MemberProvider>
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-8 page-transition">
        {children}
      </main>
    </MemberProvider>
  );
}
