"use client";

import { useState, useEffect } from "react";
import { DiscussionTopic } from "@/types";
import { Kicker, OutlineButton, SolidButton } from "./ui";
import { cn } from "@/lib/utils";

/** Questions for the meeting. Blurred until someone chooses to read them. */
export default function DiscussionTopics({
  topics,
  bookId,
  memberId,
  onAddTopic,
}: {
  topics: DiscussionTopic[];
  bookId: string;
  memberId: string | null;
  onAddTopic: (content: string) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setOpen(new Set());
  }, [bookId]);

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <Kicker>Discussion</Kicker>
        {topics.length > 0 && (
          <span className="text-[10.5px] text-muted">tap to unblur</span>
        )}
      </div>

      {topics.length === 0 && !adding && (
        <p className="py-4 text-[12.5px] text-muted">Nothing queued for the meeting yet.</p>
      )}

      {topics.map((t, i) => (
        <button
          key={t.id}
          onClick={() => toggle(t.id)}
          className={cn(
            "w-full py-[13px] text-left",
            i < topics.length - 1 && "row-line"
          )}
        >
          <span className="text-[11px] text-muted">{t.member?.name || "Anonymous"}</span>
          <p
            className={cn(
              "mt-[5px] text-[13.5px] leading-[1.5] text-ink",
              open.has(t.id) ? "score-reveal" : "score-blur"
            )}
            style={{ filter: open.has(t.id) ? "blur(0)" : "blur(4.5px)" }}
          >
            {t.content}
          </p>
        </button>
      ))}

      {memberId && (
        <div className="mt-4">
          {!adding ? (
            <OutlineButton onClick={() => setAdding(true)}>Add a question</OutlineButton>
          ) : (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                autoFocus
                placeholder="What do you want to talk about?"
                className="w-full resize-none rounded-lg border border-tan bg-transparent px-3 py-2 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-muted/60 focus:border-green"
              />
              <div className="flex gap-2">
                <OutlineButton
                  className="flex-1"
                  onClick={() => {
                    setAdding(false);
                    setDraft("");
                  }}
                >
                  Cancel
                </OutlineButton>
                <SolidButton
                  className="flex-1"
                  onClick={() => {
                    if (!draft.trim()) return;
                    onAddTopic(draft.trim());
                    setDraft("");
                    setAdding(false);
                  }}
                >
                  Add
                </SolidButton>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
