"use client";

import { Check } from "@phosphor-icons/react";
import { ProgressStatus } from "@/types";
import { Sheet } from "./ui";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<ProgressStatus, string> = {
  none: "Not started",
  reading: "In progress",
  finished: "Done",
  dnf: "Gave up",
};

const ORDER: ProgressStatus[] = ["none", "reading", "finished", "dnf"];

const BLURB: Record<ProgressStatus, string> = {
  none: "Haven't opened it",
  reading: "Somewhere in the middle",
  finished: "Finished it",
  dnf: "Put it down for good",
};

/** Marking where you are, in one tap from a list rather than a cycle. */
export default function StatusPicker({
  current,
  onPick,
  onClose,
}: {
  current: ProgressStatus;
  onPick: (s: ProgressStatus) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="Where are you?" onClose={onClose}>
      <div className="pb-2">
        {ORDER.map((s, i) => {
          const active = s === current;
          return (
            <button
              key={s}
              onClick={() => {
                onPick(s);
                onClose();
              }}
              className={cn(
                "flex w-full items-center gap-3 py-[14px] text-left",
                i < ORDER.length - 1 && "row-line"
              )}
            >
              <span
                className={cn(
                  "h-[6px] w-[6px] flex-none rounded-full",
                  s === "finished"
                    ? "bg-green"
                    : s === "reading"
                      ? "bg-teal"
                      : "bg-tan"
                )}
              />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[15px]", active ? "text-ink" : "text-ink/85")}>
                  {STATUS_LABEL[s]}
                </span>
                <span className="mt-[2px] block text-[12px] text-muted">{BLURB[s]}</span>
              </span>
              {active && <Check size={17} weight="bold" className="flex-none text-green" />}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
