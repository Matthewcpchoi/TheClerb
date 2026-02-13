"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Member } from "@/types";
import WelcomeModal from "./WelcomeModal";

interface MemberContextType {
  currentMember: Member | null;
  setCurrentMember: (member: Member) => void;
}

const MemberContext = createContext<MemberContextType>({
  currentMember: null,
  setCurrentMember: () => {},
});

export function useMember() {
  return useContext(MemberContext);
}

export default function MemberProvider({ children }: { children: ReactNode }) {
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("clerb-member");
    if (stored) {
      try {
        setCurrentMember(JSON.parse(stored));
      } catch {
        setShowWelcome(true);
      }
    } else {
      setShowWelcome(true);
    }
    setLoaded(true);
  }, []);

  function handleSelectMember(member: Member) {
    setCurrentMember(member);
    localStorage.setItem("clerb-member", JSON.stringify(member));
    setShowWelcome(false);
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="font-serif text-2xl text-mahogany animate-pulse">
          The Clerb
        </div>
      </div>
    );
  }

  return (
    <MemberContext.Provider
      value={{ currentMember, setCurrentMember: handleSelectMember }}
    >
      {showWelcome && <WelcomeModal onSelect={handleSelectMember} />}
      {children}
    </MemberContext.Provider>
  );
}
