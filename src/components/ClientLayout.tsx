"use client";

import { ReactNode } from "react";
import MemberProvider from "./MemberProvider";
import TabBar from "./TabBar";

/**
 * The design is a 402pt phone screen. On a wider viewport the app stays that
 * width and centres, rather than stretching layouts that were composed for a
 * phone.
 */
export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <MemberProvider>
      <div className="mx-auto min-h-screen max-w-[448px] bg-ground">
        <main className="screen-in pb-[96px]">{children}</main>
        <TabBar />
      </div>
    </MemberProvider>
  );
}
