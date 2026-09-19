"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { Member } from "@/types";
import { supabase } from "@/lib/supabase";
import WelcomeModal from "./WelcomeModal";

interface MemberContextType {
  currentMember: Member | null;
  setCurrentMember: (member: Member) => void;
  members: Member[];
  refreshMembers: () => Promise<void>;
}

const MemberContext = createContext<MemberContextType>({
  currentMember: null,
  setCurrentMember: () => {},
  members: [],
  refreshMembers: async () => {},
});

export function useMember() {
  return useContext(MemberContext);
}

export default function MemberProvider({ children }: { children: ReactNode }) {
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refreshMembers = useCallback(async () => {
    const { data } = await supabase.from("members").select("*").order("name");
    if (data) setMembers(data);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("members").select("*").order("name");
      const list = data || [];
      setMembers(list);

      const stored = localStorage.getItem("clerb-member");
      let resolved: Member | null = null;
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Member;
          // Revalidate: a member deleted since last visit would break every
          // write that references them.
          resolved = list.find((m) => m.id === parsed.id) ?? null;
        } catch {
          resolved = null;
        }
      }

      if (resolved) setCurrentMember(resolved);
      else {
        localStorage.removeItem("clerb-member");
        setShowWelcome(true);
      }
      setLoaded(true);
    })();
  }, []);

  function handleSelect(member: Member) {
    setCurrentMember(member);
    localStorage.setItem("clerb-member", JSON.stringify(member));
    setShowWelcome(false);
    refreshMembers();
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ground">
        <span className="kicker kicker-wide text-muted">The Clerb</span>
      </div>
    );
  }

  return (
    <MemberContext.Provider
      value={{ currentMember, setCurrentMember: handleSelect, members, refreshMembers }}
    >
      {showWelcome && <WelcomeModal onSelect={handleSelect} />}
      {children}
    </MemberContext.Provider>
  );
}
